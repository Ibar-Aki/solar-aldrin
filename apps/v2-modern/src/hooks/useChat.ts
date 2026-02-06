/**
 * チャットフック
 * OpenAI APIとの通信を管理
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useKYStore } from '@/stores/kyStore'
import { postChat } from '@/lib/api'
import { mergeExtractedData } from '@/lib/chat/mergeExtractedData'
import type { ExtractedData } from '@/types/ky'
import { sendTelemetry } from '@/lib/observability/telemetry'
import { buildContextInjection, getWeatherContext } from '@/lib/contextUtils'

const RETRY_ASSISTANT_MESSAGE = '申し訳ありません、応答に失敗しました。もう一度お試しください。'

function isTimeoutError(error: unknown) {
    if (error && typeof error === 'object') {
        const err = error as { status?: number; retriable?: boolean; message?: string }
        if (err.status === 504) return true
        if (err.retriable === true && err.status === 504) return true
        if (err.message && err.message.includes('タイムアウト')) return true
    }
    if (error instanceof Error) {
        if (error.message.includes('タイムアウト')) return true
        if (error.message.toLowerCase().includes('timeout')) return true
    }
    return false
}

export function useChat() {
    const {
        session,
        messages,
        currentWorkItem,
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
    const sendMessageInternal = useCallback(async (text: string, options?: { skipUserMessage?: boolean }) => {
        if (!session) return

        setLoading(true)
        setError(null)
        setCanRetry(false)

        const skipUserMessage = options?.skipUserMessage ?? false

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
            const errorMsg = 'APIトークンが設定されていません。環境変数 VITE_API_TOKEN を設定してください。'
            setError(errorMsg)
            addMessage('assistant', errorMsg)
            setLoading(false)
            return
        }

        try {
            const buildRequestMessages = (skipUserMessage: boolean) => {
                const chatMessages = messages
                    .filter(m => m.role !== 'system')
                    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

                if (!skipUserMessage) {
                    return [...chatMessages, { role: 'user' as const, content: text }]
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
                return sanitized
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

            // fetch ベースの API 呼び出し
            // system ロールはサーバー側で追加されるため、クライアントからは除外
            const data = await postChat({
                messages: [
                    ...buildRequestMessages(skipUserMessage),
                ],
                sessionContext: {
                    userName: session.userName,
                    siteName: session.siteName,
                    weather: session.weather,
                    workItemCount: session.workItems.length,
                    processPhase: session.processPhase ?? undefined,
                    healthCondition: session.healthCondition ?? undefined,
                },
                contextInjection,
            })

            // AI応答を追加 (extractedDataも含めて保存)
            addMessage('assistant', data.reply, data.extracted)

            // ストアの更新
            handleExtractedData(data.extracted)

        } catch (e) {
            console.error('Chat error:', e)
            setError(e instanceof Error ? e.message : '通信エラーが発生しました')
            if (isTimeoutError(e) && lastUserMessageRef.current) {
                setCanRetry(true)
            } else {
                setCanRetry(false)
            }
            // エラー時もAIメッセージを追加（再試行を促す）
            addMessage('assistant', RETRY_ASSISTANT_MESSAGE)
        } finally {
            setLoading(false)
        }
    }, [session, messages, addMessage, setLoading, setError, handleExtractedData])

    const sendMessage = useCallback(async (text: string) => {
        await sendMessageInternal(text)
    }, [sendMessageInternal])

    const retryLastMessage = useCallback(async () => {
        if (!lastUserMessageRef.current) return
        if (canRetry === false) return
        await sendMessageInternal(lastUserMessageRef.current, { skipUserMessage: true })
    }, [canRetry, sendMessageInternal])

    return {
        initializeChat,
        sendMessage,
        retryLastMessage,
        canRetry,
    }
}
