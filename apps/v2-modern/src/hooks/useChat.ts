/**
 * チャットフック
 * OpenAI APIとの通信を管理
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useKYStore } from '@/stores/kyStore'
import { ApiError, postChat, type ChatErrorType } from '@/lib/api'
import { mergeExtractedData } from '@/lib/chat/mergeExtractedData'
import type { Countermeasure, ExtractedData, WorkItem } from '@/types/ky'
import { sendTelemetry } from '@/lib/observability/telemetry'
import { buildContextInjection, getWeatherContext } from '@/lib/contextUtils'
import { buildConversationSummary } from '@/lib/chat/conversationSummary'
import { getTimeGreeting } from '@/lib/greeting'
import { getApiToken } from '@/lib/apiToken'
import { shouldEnableSilentRetryClient, shouldRequireApiTokenClient } from '@/lib/envFlags'
import { isNonAnswerText } from '@/lib/nonAnswer'
import { isWorkItemComplete } from '@/lib/validation'

const RETRY_ASSISTANT_MESSAGE = '申し訳ありません、応答に失敗しました。もう一度お試しください。'
const ENABLE_SILENT_RETRY = shouldEnableSilentRetryClient()
const MAX_SILENT_RETRIES = (() => {
    const raw = import.meta.env.VITE_SILENT_RETRY_MAX
    const parsed = typeof raw === 'string' ? Number.parseInt(raw.trim(), 10) : NaN
    // サーバー主導の再試行に寄せるため既定は0。必要時のみ環境変数で明示的に有効化する。
    if (!Number.isFinite(parsed)) return 0
    return Math.max(0, Math.min(parsed, 2))
})()

type RetrySource = 'none' | 'manual' | 'silent'
const MAX_CLIENT_HISTORY_MESSAGES = 12
const CONVERSATION_SUMMARY_MIN_MESSAGES = 6
const ACTION_GOAL_MAX_LENGTH = 120

type NormalizedChatError = {
    message: string
    errorType: ChatErrorType
    code?: string
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
            code?: string
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
            code: typeof ext.code === 'string' ? ext.code : undefined,
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
    const requireAuth = shouldRequireApiTokenClient()

    switch (apiError.errorType) {
        case 'auth':
            return {
                message: requireAuth
                    ? '認証エラーです。ホーム画面の「APIトークン設定」から設定するか、管理者に確認してください。'
                    : '認証エラーです。サーバー側の認証設定を確認してください。',
                errorType: 'auth',
                code: apiError.code,
                status: apiError.status,
                retriable: apiError.retriable,
                retryAfterSec,
                canRetry: false,
            }
        case 'network':
            return {
                message: '通信が不安定です。電波の良い場所で再送してください。',
                errorType: 'network',
                code: apiError.code,
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
                code: apiError.code,
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
                code: apiError.code,
                status: apiError.status,
                retriable: apiError.retriable,
                retryAfterSec,
                canRetry: true,
            }
        case 'server':
            if (apiError.code === 'AI_RESPONSE_INVALID_SCHEMA') {
                return {
                    message: 'AI応答の形式チェックに失敗しました。再送してください。',
                    errorType: 'server',
                    code: apiError.code,
                    status: apiError.status,
                    retriable: apiError.retriable,
                    retryAfterSec,
                    canRetry: apiError.retriable,
                }
            }
            if (apiError.code === 'AI_RESPONSE_INVALID_JSON') {
                return {
                    message: 'AI応答のJSON復元に失敗しました。再送してください。',
                    errorType: 'server',
                    code: apiError.code,
                    status: apiError.status,
                    retriable: apiError.retriable,
                    retryAfterSec,
                    canRetry: apiError.retriable,
                }
            }
            return {
                message: apiError.retriable
                    ? 'AIサービスが混雑しています。少し待ってから再送してください。'
                    : 'システムエラーが発生しました。時間をおいて再送してください。',
                errorType: 'server',
                code: apiError.code,
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
                code: apiError.code,
                status: apiError.status,
                retriable: apiError.retriable,
                retryAfterSec,
                canRetry: Boolean(apiError.retriable),
            }
    }
}

function shouldSilentRetry(error: NormalizedChatError): boolean {
    if (!ENABLE_SILENT_RETRY || MAX_SILENT_RETRIES <= 0) return false
    // 429のときのみ限定的に自動再送を許可。その他は手動リトライへ誘導する。
    if (error.errorType === 'rate_limit' && error.retriable) return true
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

function normalizeActionGoalText(value: string): string {
    return value
        .replace(/\s+/g, ' ')
        .replace(/^[「『"\s]+/, '')
        .replace(/[」』"\s]+$/, '')
        .trim()
        .slice(0, ACTION_GOAL_MAX_LENGTH)
}

function isLikelyActionGoalPhrase(value: string): boolean {
    if (!value) return false
    const normalized = normalizeActionGoalText(value)
    if (!normalized) return false
    if (isNonAnswerText(normalized)) return false
    if (normalized.length > 40) return false
    if (/^(はい|了解|ok|okay|お願いします|大丈夫です)$/i.test(normalized)) return false
    return /(よし|ヨシ|確認|徹底|厳守|実施)/.test(normalized)
}

function extractActionGoalFromText(text: string): string | null {
    const normalizedInput = text
        .replace(/\r?\n/g, ' ')
        .trim()

    if (!normalizedInput) return null

    const quotedMatches = [...normalizedInput.matchAll(/[「『"]([^「」『"\n]{2,120})[」』"]/g)]
    for (const match of quotedMatches) {
        const candidate = normalizeActionGoalText(match[1] ?? '')
        if (candidate && !isNonAnswerText(candidate)) {
            return candidate
        }
    }

    const prefixed = normalizedInput.match(
        /(?:行動目標|目標)\s*(?:は|を|:|：)?\s*([^。.!！?？\n]+?)(?:です|にします|とします|にする|とする)?(?:$|。|!|！|\?|？)/
    )
    if (prefixed?.[1]) {
        const candidate = normalizeActionGoalText(
            prefixed[1].replace(/(?:これで.*|内容を.*|終了.*|完了.*)$/u, '').trim()
        )
        if (candidate && !isNonAnswerText(candidate)) {
            return candidate
        }
    }

    if (isLikelyActionGoalPhrase(normalizedInput)) {
        return normalizeActionGoalText(normalizedInput)
    }

    return null
}

function hasCompletionIntent(text: string): boolean {
    const normalized = text
        .normalize('NFKC')
        .replace(/\s+/g, '')
        .toLowerCase()
    if (!normalized) return false
    return (
        normalized.includes('確定') ||
        normalized.includes('終了') ||
        normalized.includes('完了') ||
        normalized.includes('終わり') ||
        normalized.includes('これでok') ||
        normalized.includes('これで大丈夫') ||
        normalized.includes('finish') ||
        normalized.includes('done')
    )
}

function countValidCountermeasures(countermeasures: Countermeasure[] | undefined): number {
    if (!countermeasures || countermeasures.length === 0) return 0
    return countermeasures
        .map((cm) => (typeof cm.text === 'string' ? cm.text.trim() : ''))
        .filter((text) => text.length > 0 && !isNonAnswerText(text))
        .length
}

function limitCountermeasuresToThree(countermeasures: Countermeasure[] | undefined): Countermeasure[] {
    if (!countermeasures || countermeasures.length === 0) return []
    return countermeasures
        .map((cm) => ({ ...cm, text: typeof cm.text === 'string' ? cm.text.trim() : '' }))
        .filter((cm) => cm.text.length > 0 && !isNonAnswerText(cm.text))
        .slice(0, 3)
}

function isFirstWorkItemCompletionPending(
    status: string,
    workItemCount: number,
    currentWorkItem: Partial<WorkItem>
): boolean {
    return status === 'work_items' && workItemCount === 0 && isWorkItemComplete(currentWorkItem)
}

function isMoveToSecondKyIntent(text: string): boolean {
    const normalized = text
        .normalize('NFKC')
        .trim()
        .replace(/[\s\u3000]+/g, '')
        .toLowerCase()

    if (!normalized) return false

    return (
        (normalized.includes('2件目') && (normalized.includes('移') || normalized.includes('次'))) ||
        normalized.includes('次へ') ||
        normalized.includes('移ります') ||
        normalized.includes('移動します') ||
        normalized.includes('他にありません') ||
        normalized.includes('これで十分') ||
        normalized.includes('これで完了')
    )
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
        startNewWorkItem,
        completeSession,
        updateActionGoal,
        setStatus,
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
        const greeting = getTimeGreeting()
        const processPhase = (session.processPhase ?? 'フリー').trim() || 'フリー'
        addMessage(
            'assistant',
            [
                `${greeting}`,
                `本日は${processPhase}ですね。今日もこれから安全に作業をしましょう。`,
                'まず、1件目の想定される危険を教えてください。',
            ].join('\n')
        )
    }, [session, addMessage, setEnvironmentRisk])

    /**
     * サーバーから返却された抽出データを元にストアを更新
     */
    const handleExtractedData = useCallback((data?: ExtractedData | null) => {
        const stateBefore = useKYStore.getState()
        const latestSession = stateBefore.session
        const latestStatus = stateBefore.status
        const latestWorkItem = stateBefore.currentWorkItem
        const isFirstWorkItemContext = Boolean(
            latestSession &&
            latestStatus === 'work_items' &&
            latestSession.workItems.length === 0
        )
        const beforeMeasureCount = countValidCountermeasures(latestWorkItem.countermeasures)

        if (data?.nextAction) {
            switch (data.nextAction) {
                case 'ask_goal':
                    setStatus('action_goal')
                    break
                case 'confirm':
                case 'completed':
                    setStatus('confirmation')
                    break
                default:
                    setStatus('work_items')
                    break
            }
        }

        // Note: sendMessageInternal は UI 操作（危険度ボタン等）と同フレームで呼ばれることがあり、
        // hook のクロージャが最新の currentWorkItem を保持していない場合がある。
        // ここでは常に最新の state を参照して判定する。
        const { workItemPatch, actionGoal, shouldCommitWorkItem } = mergeExtractedData(latestWorkItem, data)

        if (actionGoal) {
            updateActionGoal(actionGoal)
        }

        let patchToApply = workItemPatch
        const mergedWorkItem = { ...latestWorkItem, ...workItemPatch }
        const mergedMeasureCount = countValidCountermeasures(mergedWorkItem.countermeasures)
        if (isFirstWorkItemContext && mergedMeasureCount > 3) {
            patchToApply = {
                ...patchToApply,
                countermeasures: limitCountermeasuresToThree(mergedWorkItem.countermeasures),
            }
        }

        if (Object.keys(patchToApply).length > 0) {
            updateCurrentWorkItem(patchToApply)
        }

        // 1件目は「1件目完了」操作でのみ確定させる（AI nextAction ではコミットしない）
        if (shouldCommitWorkItem && !isFirstWorkItemContext) {
            commitWorkItem()
        }

        const stateAfter = useKYStore.getState()
        if (!stateAfter.session) return

        let stateForPendingCheck = stateAfter
        if (stateAfter.session.workItems.length === 0 && stateAfter.status !== 'work_items') {
            setStatus('work_items')
            stateForPendingCheck = useKYStore.getState()
        }

        const isFirstPendingAfterUpdate = isFirstWorkItemCompletionPending(
            stateForPendingCheck.status,
            stateForPendingCheck.session?.workItems.length ?? 0,
            stateForPendingCheck.currentWorkItem
        )
        if (!isFirstPendingAfterUpdate) return

        const afterMeasureCount = countValidCountermeasures(stateForPendingCheck.currentWorkItem.countermeasures)
        if (beforeMeasureCount < 2 && afterMeasureCount >= 2) {
            addMessage(
                'assistant',
                '他に何か対策はありますか？それとも、2件目のKYに移りますか？',
                { nextAction: 'ask_countermeasure' }
            )
            return
        }

        if (beforeMeasureCount < 3 && afterMeasureCount >= 3) {
            addMessage(
                'assistant',
                '3件目の対策を追記しました。続けるには「1件目完了」を押してください。',
                { nextAction: 'ask_countermeasure' }
            )
        }
    }, [updateCurrentWorkItem, commitWorkItem, updateActionGoal, setStatus, addMessage])

    const isKYCompleteCommand = (text: string): boolean => {
        const normalized = text
            .normalize('NFKC')
            .trim()
            .replace(/[\s\u3000]+/g, '') // 空白（全角含む）除去
            .replace(/[。．.!！?？]+$/g, '') // 末尾の句読点除去（誤爆防止: 中間は残す）
            .toUpperCase()
        return normalized === 'KY完了'
    }

    const applyRiskLevelSelection = useCallback((level: 1 | 2 | 3 | 4 | 5) => {
        if (!session) return
        if (inFlightRef.current) return
        if (status !== 'work_items') return

        updateCurrentWorkItem({ riskLevel: level })

        const userText = `危険度は${level}です`
        addMessage('user', userText)
        void sendTelemetry({
            event: 'input_length',
            sessionId: session.id,
            value: userText.length,
            data: {
                source: 'risk_level_button',
            },
        })

        setError(null)
        addMessage(
            'assistant',
            'その危険を防ぐための、1つ目の対策を教えてください。',
            { nextAction: 'ask_countermeasure' }
        )
    }, [session, status, updateCurrentWorkItem, addMessage, setError])

    const completeFirstWorkItem = useCallback((): boolean => {
        const latest = useKYStore.getState()
        if (!latest.session) return false
        if (latest.status !== 'work_items') return false
        if (latest.session.workItems.length !== 0) return false
        if (!isWorkItemComplete(latest.currentWorkItem)) {
            latest.setError('作業項目が不完全です（対策は2件以上が必要です）', 'validation')
            return false
        }

        latest.setError(null)
        latest.commitWorkItem()

        const afterCommit = useKYStore.getState()
        if (!afterCommit.session) return false
        if (afterCommit.session.workItems.length !== 1) return false

        afterCommit.setStatus('work_items')
        afterCommit.addMessage(
            'assistant',
            '次の、2件目の想定される危険を教えてください。',
            { nextAction: 'ask_hazard' }
        )
        return true
    }, [])

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
            const requireAuth = shouldRequireApiTokenClient()
            const hasToken = Boolean(getApiToken())

            if (requireAuth && !hasToken) {
                const errorMsg = '認証エラーです。ホーム画面の「APIトークン設定」から設定するか、管理者に確認してください。'
                setError(errorMsg, 'chat')
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

            let data: Awaited<ReturnType<typeof postChat>> | undefined
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
                            attempt: 0,
                        },
                    })

                    // Live APIs can be intermittently flaky. Retry a few times, respecting Retry-After when available.
                    let lastError = normalizedFirstError

                    for (let attempt = 1; attempt <= MAX_SILENT_RETRIES; attempt++) {
                        try {
                            const baseDelayMs = computeSilentRetryDelayMs(lastError)
                            const delayMs = baseDelayMs > 0 ? Math.min(10_000, baseDelayMs * attempt) : 0
                            if (delayMs > 0) {
                                void sendTelemetry({
                                    event: 'retry_waiting',
                                    sessionId: session.id,
                                    value: delayMs,
                                    data: {
                                        source: 'silent',
                                        error_type: lastError.errorType,
                                        retry_after_sec: lastError.retryAfterSec ?? null,
                                        attempt,
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
                                    attempt,
                                },
                            })
                            lastError = null as never
                            break
                        } catch (silentRetryError) {
                            const normalizedSilentRetryError = normalizeChatError(silentRetryError)
                            lastError = normalizedSilentRetryError

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
                                    attempt,
                                },
                            })

                            if (attempt >= MAX_SILENT_RETRIES || !shouldSilentRetry(normalizedSilentRetryError)) {
                                void sendTelemetry({
                                    event: 'retry_failed',
                                    sessionId: session.id,
                                    data: {
                                        source: 'silent',
                                        error_type: normalizedSilentRetryError.errorType,
                                        attempt,
                                    },
                                })
                                throw normalizedSilentRetryError
                            }
                        }
                    }
                } else {
                    throw normalizedFirstError
                }
            }

            // TypeScript can't always prove the control-flow guarantees above.
            if (!data) throw new Error('Chat request completed without a response payload')

            const normalizeActionGoalResponse = () => {
                if (status !== 'action_goal' && status !== 'confirmation') {
                    return data
                }
                const extracted = data.extracted ? { ...data.extracted } : {}
                const userGoal = extractActionGoalFromText(text)
                if (!userGoal) {
                    return data
                }

                const asksGoalAgain = extracted.nextAction === 'ask_goal'
                const hasActionGoal = typeof extracted.actionGoal === 'string' && extracted.actionGoal.trim().length > 0
                if (!asksGoalAgain && hasActionGoal) {
                    return data
                }

                return {
                    ...data,
                    reply: '行動目標を記録しました。内容を確認して、画面の「完了」ボタンを押してください。',
                    extracted: {
                        ...extracted,
                        actionGoal: hasActionGoal ? extracted.actionGoal : userGoal,
                        nextAction: 'confirm' as const,
                    },
                }
            }

            const normalizedData = normalizeActionGoalResponse()

            // AI応答を追加 (extractedDataも含めて保存)
            addMessage('assistant', normalizedData.reply, normalizedData.extracted)

            // ストアの更新
            handleExtractedData(normalizedData.extracted)

        } catch (e) {
            const normalizedError =
                e && typeof e === 'object' && 'errorType' in e
                    ? (e as NormalizedChatError)
                    : normalizeChatError(e)
            console.error('Chat error:', normalizedError)
            setError(normalizedError.message, 'chat')
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
        // 1件目の対策が2件以上そろったら、完了操作（ボタン/移行テキスト）でのみ2件目へ進める
        if (session && status === 'work_items' && session.workItems.length === 0) {
            const normalized = text.trim()
            const isFirstPending = isFirstWorkItemCompletionPending(status, session.workItems.length, currentWorkItem)
            if (isFirstPending && normalized.length > 0) {
                addMessage('user', normalized)
                void sendTelemetry({
                    event: 'input_length',
                    sessionId: session.id,
                    value: normalized.length,
                    data: {
                        source: 'chat',
                    },
                })

                if (isMoveToSecondKyIntent(normalized)) {
                    setError(null)
                    completeFirstWorkItem()
                    return
                }

                const measureCount = countValidCountermeasures(currentWorkItem.countermeasures)
                if (measureCount >= 3) {
                    setError(null)
                    addMessage(
                        'assistant',
                        '対策は3件目まで追記済みです。「1件目完了」を押してください。',
                        { nextAction: 'ask_countermeasure' }
                    )
                    return
                }

                // 3件目の抽出だけを行うため、既に追加済みの user メッセージを再利用する
                await sendMessageInternal(normalized, { retrySource: 'none', skipUserMessage: true })
                return
            }
        }

        // 仕様: 2件が完了済みなら「KY完了」で即時にセッション完了（APIは呼ばない）
        if (session && status !== 'completed' && session.workItems.length >= 2 && isKYCompleteCommand(text)) {
            const normalized = text.trim()
            addMessage('user', normalized)
            void sendTelemetry({
                event: 'input_length',
                sessionId: session.id,
                value: normalized.length,
                data: {
                    source: 'chat',
                },
            })

            setError(null)
            startNewWorkItem()
            completeSession({
                actionGoal: session.actionGoal ?? null,
                pointingConfirmed: session.pointingConfirmed ?? null,
                allMeasuresImplemented: session.allMeasuresImplemented ?? null,
                hadNearMiss: session.hadNearMiss ?? null,
                nearMissNote: session.nearMissNote ?? null,
            })
            addMessage(
                'assistant',
                '2件の危険と対策が完了しました。KY完了です！',
                { nextAction: 'completed' }
            )
            return
        }

        // 仕様: 2件目の途中でも「KY完了」で本日のKYを打ち切れる（未完成の2件目は破棄）
        if (session && status === 'work_items' && session.workItems.length >= 1 && isKYCompleteCommand(text)) {
            const normalized = text.trim()
            addMessage('user', normalized)
            void sendTelemetry({
                event: 'input_length',
                sessionId: session.id,
                value: normalized.length,
                data: {
                    source: 'chat',
                },
            })

            setError(null)
            startNewWorkItem()
            setStatus('action_goal')
            addMessage(
                'assistant',
                [
                    '了解です。2件目はここで打ち切って、本日のKYを完了に進めます。',
                    '今日の行動目標を、短く1つだけ教えてください。',
                ].join('\n'),
                { nextAction: 'ask_goal' }
            )
            return
        }

        // 仕様: 行動目標フェーズでは、明確な目標入力はローカル確定して重複質問を抑止する（APIは呼ばない）
        if (session && (status === 'action_goal' || status === 'confirmation')) {
            const normalized = text.trim()
            const inputGoal = extractActionGoalFromText(text)
            const completionIntent = hasCompletionIntent(text)
            const existingGoal = typeof session.actionGoal === 'string' ? normalizeActionGoalText(session.actionGoal) : ''
            const finalGoal = inputGoal ?? (completionIntent && existingGoal ? existingGoal : null)

            if (finalGoal) {
                addMessage('user', normalized)
                void sendTelemetry({
                    event: 'input_length',
                    sessionId: session.id,
                    value: normalized.length,
                    data: {
                        source: 'chat',
                    },
                })

                setError(null)
                updateActionGoal(finalGoal)
                setStatus('confirmation')
                addMessage(
                    'assistant',
                    '行動目標を記録しました。内容を確認して、画面の「完了」ボタンを押してください。',
                    {
                        actionGoal: finalGoal,
                        nextAction: 'confirm',
                    }
                )
                return
            }
        }

        await sendMessageInternal(text, { retrySource: 'none' })
    }, [session, status, currentWorkItem, addMessage, setError, startNewWorkItem, completeSession, setStatus, sendMessageInternal, updateActionGoal, completeFirstWorkItem])

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
        completeFirstWorkItem,
        applyRiskLevelSelection,
        retryLastMessage,
        canRetry,
    }
}
