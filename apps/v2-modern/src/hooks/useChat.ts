/**
 * チャットフック
 * OpenAI APIとの通信を管理
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useKYStore } from '@/stores/kyStore'
import { ApiError, postChat, type ChatErrorType } from '@/lib/api'
import { mergeExtractedData } from '@/lib/chat/mergeExtractedData'
import type { ExtractedData } from '@/types/ky'
import { sendTelemetry } from '@/lib/observability/telemetry'
import { buildContextInjection, getWeatherContext } from '@/lib/contextUtils'
import { buildConversationSummary } from '@/lib/chat/conversationSummary'

const RETRY_ASSISTANT_MESSAGE = '申し訳ありません、応答に失敗しました。もう一度お試しください。'
const ENABLE_SILENT_RETRY = (() => {
    const raw = import.meta.env.VITE_ENABLE_RETRY_SILENT
    if (raw === '1') return true
    if (raw === '0') return false
    // UIUX優先: 本番ではデフォルトでサイレントリトライを有効化する
    return Boolean(import.meta.env.PROD)
})()

type RetrySource = 'none' | 'manual' | 'silent'
const MAX_CLIENT_HISTORY_MESSAGES = 12
const CONVERSATION_SUMMARY_MIN_MESSAGES = 6

type NormalizedChatError = {
    message: string
    errorType: ChatErrorType
    status?: number
    retriable: boolean
    retryAfterSec?: number
    canRetry: boolean
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function toApiError(error: unknown): ApiError {
    if (error instanceof ApiError) {
        return error
    }

    if (error instanceof Error) {
        const ext = error as Error & {
            status?: number
            retriable?: boolean
            retryAfterSec?: number
        }
        const lower = error.message.toLowerCase()

        let inferredType: ChatErrorType | undefined
        if (typeof ext.status === 'number') {
            if (ext.status === 401) inferredType = 'auth'
            else if (ext.status === 429) inferredType = 'rate_limit'
            else if (ext.status === 504) inferredType = 'timeout'
            else if (ext.status >= 500) inferredType = 'server'
        } else if (error.message.includes('タイムアウト') || lower.includes('timeout')) {
            inferredType = 'timeout'
        } else if (error.message.includes('通信') || lower.includes('network')) {
            inferredType = 'network'
        }

        return new ApiError(error.message, {
            status: ext.status,
            retriable: Boolean(ext.retriable),
            retryAfterSec: ext.retryAfterSec,
            errorType: inferredType,
        })
    }

    return new ApiError('通信が不安定です。電波の良い場所で再送してください。', {
        errorType: 'network',
        retriable: false,
    })
}

function normalizeChatError(error: unknown): NormalizedChatError {
    const apiError = toApiError(error)
    const retryAfterSec = apiError.retryAfterSec

    switch (apiError.errorType) {
        case 'auth':
            return {
                message: '認証エラーです。管理者にAPIトークン設定を確認してください。',
                errorType: 'auth',
                status: apiError.status,
                retriable: apiError.retriable,
                retryAfterSec,
                canRetry: false,
            }
        case 'network':
            return {
                message: '通信が不安定です。電波の良い場所で再送してください。',
                errorType: 'network',
                status: apiError.status,
                retriable: apiError.retriable,
                retryAfterSec,
                // UX: 通信エラーも「もう一度試す」で回復することがあるため、手動リトライは許可する。
                canRetry: true,
            }
        case 'timeout':
            return {
                message: 'AI応答が遅れています。少し待ってから再送してください。',
                errorType: 'timeout',
                status: apiError.status,
                retriable: apiError.retriable,
                retryAfterSec,
                canRetry: true,
            }
        case 'rate_limit':
            return {
                message: retryAfterSec
                    ? `混雑中です。${retryAfterSec}秒ほど待ってから再送してください。`
                    : '混雑中です。少し待ってから再送してください。',
                errorType: 'rate_limit',
                status: apiError.status,
                retriable: apiError.retriable,
                retryAfterSec,
                canRetry: true,
            }
        case 'server':
            return {
                message: apiError.retriable
                    ? 'AIサービスが混雑しています。少し待ってから再送してください。'
                    : 'システムエラーが発生しました。時間をおいて再送してください。',
                errorType: 'server',
                status: apiError.status,
                retriable: apiError.retriable,
                retryAfterSec,
                canRetry: apiError.retriable,
            }
        case 'unknown':
        default:
            return {
                message: apiError.message || '通信エラーが発生しました。再送してください。',
                errorType: 'unknown',
                status: apiError.status,
                retriable: apiError.retriable,
                retryAfterSec,
                canRetry: Boolean(apiError.retriable),
            }
    }
}

function shouldSilentRetry(error: NormalizedChatError): boolean {
    if (!ENABLE_SILENT_RETRY) return false
    if (error.errorType === 'timeout') return true
    if (error.errorType === 'rate_limit') return true
    if (error.errorType === 'server' && error.retriable) return true
    return false
}

function computeSilentRetryDelayMs(error: NormalizedChatError): number {
    const retryAfterSec = error.retryAfterSec
    if (typeof retryAfterSec === 'number' && Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
        // 平均応答時間が増えすぎないよう、上限を設ける（UX優先: 即時連打を避ける）
        return Math.min(10, retryAfterSec) * 1000
    }

    const jitter = Math.floor(Math.random() * 400)
    if (error.errorType === 'rate_limit') return 2000 + jitter
    if (error.errorType === 'timeout') return 1200 + jitter
    if (error.errorType === 'server') return 1200 + jitter
    return 0
}

export function useChat() {
    const {
        session,
        messages,
        currentWorkItem,
        status,
        addMessage,
        updateCurrentWorkItem,
        commitWorkItem,
        updateActionGoal,
        setLoading,
        setError,
        setEnvironmentRisk,
    } = useKYStore()

    const contextRef = useRef<{ sessionId: string; injection: string | null } | null>(null)
    const lastUserMessageRef = useRef<string | null>(null)
    const inFlightRef = useRef(false)
    const [canRetry, setCanRetry] = useState(false)

    const sessionId = session?.id

    useEffect(() => {
        if (!sessionId) {
            contextRef.current = null
            return
        }
        if (contextRef.current?.sessionId !== sessionId) {
            contextRef.current = null
        }
    }, [sessionId])

    /**
     * 初期メッセージを送信
     */
    const initializeChat = useCallback(async () => {
        if (!session) return

        // 環境リスクの設定（天候ベース）
        const weatherContext = getWeatherContext(session.weather)
        if (weatherContext) {
            setEnvironmentRisk(weatherContext.note)
        }

        // 初回AIメッセージ
        addMessage(
            'assistant',
            `${session.userName}さん、今日も安全に作業しましょう！\n${session.siteName}での作業ですね。天候は${session.weather}です。\n今日行う作業内容を教えてください。`
        )
    }, [session, addMessage, setEnvironmentRisk])

    /**
     * サーバーから返却された抽出データを元にストアを更新
     */
    const handleExtractedData = useCallback((data?: ExtractedData | null) => {
        const { workItemPatch, actionGoal, shouldCommitWorkItem } = mergeExtractedData(currentWorkItem, data)

        if (actionGoal) {
            updateActionGoal(actionGoal)
        }

        if (Object.keys(workItemPatch).length > 0) {
            updateCurrentWorkItem(workItemPatch)
        }

        if (shouldCommitWorkItem) {
            commitWorkItem()
        }
    }, [updateCurrentWorkItem, commitWorkItem, updateActionGoal, currentWorkItem])

    /**
     * メッセージを送信してAI応答を取得
     */
    const sendMessageInternal = useCallback(async (text: string, options?: { skipUserMessage?: boolean; retrySource?: RetrySource }) => {
        if (!session || inFlightRef.current) return

        const retrySource = options?.retrySource ?? 'none'
        const skipUserMessage = options?.skipUserMessage ?? false

        inFlightRef.current = true
        setLoading(true)
        setError(null)
        setCanRetry(false)

        try {
            // ユーザーメッセージを追加
            if (!skipUserMessage) {
                addMessage('user', text)
                void sendTelemetry({
                    event: 'input_length',
                    sessionId: session.id,
                    value: text.length,
                    data: {
                        source: 'chat',
                    },
                })
            }
            lastUserMessageRef.current = text

            // 認証チェック (Hardening Phase C)
            const requireAuth = import.meta.env.VITE_REQUIRE_API_TOKEN === '1'
            const hasToken = Boolean(import.meta.env.VITE_API_TOKEN)

            if (requireAuth && !hasToken) {
                const errorMsg = '認証エラーです。管理者にAPIトークン設定を確認してください。'
                setError(errorMsg)
                addMessage('assistant', errorMsg)
                return
            }

            const buildRequestMessages = (shouldSkipUserMessage: boolean) => {
                const chatMessages = messages
                    .filter(m => m.role !== 'system')
                    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

                if (!shouldSkipUserMessage) {
                    const combined = [...chatMessages, { role: 'user' as const, content: text }]
                    return combined.slice(-MAX_CLIENT_HISTORY_MESSAGES)
                }

                // リトライ時は末尾のエラーメッセージを除去し、同じユーザー発言を末尾に置く
                const sanitized = [...chatMessages]
                const last = sanitized[sanitized.length - 1]
                if (last && last.role === 'assistant' && last.content === RETRY_ASSISTANT_MESSAGE) {
                    sanitized.pop()
                }
                const lastAfter = sanitized[sanitized.length - 1]
                if (!lastAfter || lastAfter.role !== 'user' || lastAfter.content !== text) {
                    sanitized.push({ role: 'user' as const, content: text })
                }
                return sanitized.slice(-MAX_CLIENT_HISTORY_MESSAGES)
            }

            const contextEnabled = import.meta.env.VITE_ENABLE_CONTEXT_INJECTION !== '0'
            let contextInjection: string | undefined

            if (contextEnabled) {
                if (!contextRef.current || contextRef.current.sessionId !== session.id) {
                    contextRef.current = { sessionId: session.id, injection: null }
                }

                if (contextRef.current.injection === null) {
                    try {
                        contextRef.current.injection = await buildContextInjection({
                            session,
                            userInput: text,
                        })
                    } catch (error) {
                        console.warn('Context injection build failed:', error)
                        contextRef.current.injection = null
                    }
                }

                contextInjection = contextRef.current.injection ?? undefined
            }

            const requestChat = async (shouldSkipUserMessage: boolean) => postChat({
                messages: [...buildRequestMessages(shouldSkipUserMessage)],
                sessionContext: {
                    userName: session.userName,
                    siteName: session.siteName,
                    weather: session.weather,
                    workItemCount: session.workItems.length,
                    processPhase: session.processPhase ?? undefined,
                    healthCondition: session.healthCondition ?? undefined,
                },
                contextInjection,
                conversationSummary: (() => {
                    // Short chats shouldn't pay the summary token cost.
                    const baseCount = messages.filter(m => m.role !== 'system').length
                    const effectiveCount = baseCount + (shouldSkipUserMessage ? 0 : 1)
                    if (effectiveCount < CONVERSATION_SUMMARY_MIN_MESSAGES) return undefined
                    return buildConversationSummary({
                        session,
                        currentWorkItem,
                        status,
                    })
                })(),
            })

            let data: Awaited<ReturnType<typeof postChat>>
            try {
                data = await requestChat(skipUserMessage)
            } catch (firstError) {
                const normalizedFirstError = normalizeChatError(firstError)
                void sendTelemetry({
                    event: 'chat_error',
                    sessionId: session.id,
                    value: normalizedFirstError.status ?? 0,
                    data: {
                        error_type: normalizedFirstError.errorType,
                        status: normalizedFirstError.status ?? null,
                        retriable: normalizedFirstError.retriable,
                        network_online: typeof navigator !== 'undefined' ? navigator.onLine : null,
                        retry_after_sec: normalizedFirstError.retryAfterSec ?? null,
                    },
                })

                if (shouldSilentRetry(normalizedFirstError) && retrySource === 'none') {
                    void sendTelemetry({
                        event: 'retry_clicked',
                        sessionId: session.id,
                        data: {
                            source: 'silent',
                            error_type: normalizedFirstError.errorType,
                        },
                    })

                    try {
                        const delayMs = computeSilentRetryDelayMs(normalizedFirstError)
                        if (delayMs > 0) {
                            void sendTelemetry({
                                event: 'retry_waiting',
                                sessionId: session.id,
                                value: delayMs,
                                data: {
                                    source: 'silent',
                                    error_type: normalizedFirstError.errorType,
                                    retry_after_sec: normalizedFirstError.retryAfterSec ?? null,
                                },
                            })
                            await sleep(delayMs)
                        }
                        data = await requestChat(true)
                        void sendTelemetry({
                            event: 'retry_succeeded',
                            sessionId: session.id,
                            data: {
                                source: 'silent',
                            },
                        })
                    } catch (silentRetryError) {
                        const normalizedSilentRetryError = normalizeChatError(silentRetryError)
                        void sendTelemetry({
                            event: 'chat_error',
                            sessionId: session.id,
                            value: normalizedSilentRetryError.status ?? 0,
                            data: {
                                error_type: normalizedSilentRetryError.errorType,
                                status: normalizedSilentRetryError.status ?? null,
                                retriable: normalizedSilentRetryError.retriable,
                                network_online: typeof navigator !== 'undefined' ? navigator.onLine : null,
                                retry_after_sec: normalizedSilentRetryError.retryAfterSec ?? null,
                                source: 'silent',
                            },
                        })
                        void sendTelemetry({
                            event: 'retry_failed',
                            sessionId: session.id,
                            data: {
                                source: 'silent',
                                error_type: normalizedSilentRetryError.errorType,
                            },
                        })
                        throw normalizedSilentRetryError
                    }
                } else {
                    throw normalizedFirstError
                }
            }

            // AI応答を追加 (extractedDataも含めて保存)
            addMessage('assistant', data.reply, data.extracted)

            // ストアの更新
            handleExtractedData(data.extracted)

        } catch (e) {
            const normalizedError =
                e && typeof e === 'object' && 'errorType' in e
                    ? (e as NormalizedChatError)
                    : normalizeChatError(e)
            console.error('Chat error:', normalizedError)
            setError(normalizedError.message)
            setCanRetry(Boolean(lastUserMessageRef.current) && normalizedError.canRetry)

            if (retrySource !== 'none') {
                void sendTelemetry({
                    event: 'retry_failed',
                    sessionId: session.id,
                    value: normalizedError.status ?? 0,
                    data: {
                        source: retrySource,
                        error_type: normalizedError.errorType,
                        status: normalizedError.status ?? null,
                    },
                })
            }

            // エラー時もAIメッセージを追加（再試行を促す）
            addMessage('assistant', RETRY_ASSISTANT_MESSAGE)
        } finally {
            setLoading(false)
            inFlightRef.current = false
        }
    }, [session, messages, addMessage, setLoading, setError, handleExtractedData, currentWorkItem, status])

    const sendMessage = useCallback(async (text: string) => {
        await sendMessageInternal(text, { retrySource: 'none' })
    }, [sendMessageInternal])

    const retryLastMessage = useCallback(async () => {
        if (!lastUserMessageRef.current) return
        if (canRetry === false) return
        if (!session) return
        void sendTelemetry({
            event: 'retry_clicked',
            sessionId: session.id,
            data: {
                source: 'manual',
            },
        })
        await sendMessageInternal(lastUserMessageRef.current, {
            skipUserMessage: true,
            retrySource: 'manual',
        })
        const afterRetryState = useKYStore.getState()
        if (!afterRetryState.error) {
            void sendTelemetry({
                event: 'retry_succeeded',
                sessionId: session.id,
                data: {
                    source: 'manual',
                },
            })
        }
    }, [canRetry, sendMessageInternal, session])

    return {
        initializeChat,
        sendMessage,
        retryLastMessage,
        canRetry,
    }
}
