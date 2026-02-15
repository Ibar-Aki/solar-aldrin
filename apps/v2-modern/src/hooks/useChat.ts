/**
 * チャットフック
 * OpenAI APIとの通信を管理
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useKYStore } from '@/stores/kyStore'
import { postChat } from '@/lib/api'
import { mergeExtractedData } from '@/lib/chat/mergeExtractedData'
import type { ExtractedData, SafetyConfirmationChecks } from '@/types/ky'
import { sendTelemetry } from '@/lib/observability/telemetry'
import { buildContextInjection, getWeatherContext } from '@/lib/contextUtils'
import { buildConversationSummary } from '@/lib/chat/conversationSummary'
import { getTimeGreeting } from '@/lib/greeting'
import { getApiToken } from '@/lib/apiToken'
import { shouldRequireApiTokenClient } from '@/lib/envFlags'
import { isWorkItemComplete } from '@/lib/validation'
import { extractActionGoalFromText, hasCompletionIntent, normalizeActionGoalText } from '@/hooks/chat/actionGoal'
import {
    computeSilentRetryDelayMs,
    MAX_SILENT_RETRIES,
    normalizeChatError,
    type NormalizedChatError,
    shouldLogChatErrorToConsole,
    shouldSilentRetry,
    sleep,
} from '@/hooks/chat/errorHandling'
import { buildRequestMessages, CONVERSATION_SUMMARY_MIN_MESSAGES } from '@/hooks/chat/requestPayload'
import {
    countValidCountermeasures,
    isFirstWorkItemCompletionPending,
    isMoveToSecondKyIntent,
    limitCountermeasuresToThree,
} from '@/hooks/chat/workItemUtils'

const RETRY_ASSISTANT_MESSAGE = '申し訳ありません、応答に失敗しました。もう一度お試しください。'

type RetrySource = 'none' | 'manual' | 'silent'

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
        const isSecondWorkItemContext = Boolean(
            latestSession &&
            latestStatus === 'work_items' &&
            latestSession.workItems.length === 1
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

        // 1件目/2件目は完了ボタン操作でのみ確定させる（AI nextAction ではコミットしない）
        if (shouldCommitWorkItem && !isFirstWorkItemContext && !isSecondWorkItemContext) {
            commitWorkItem()
        }

        const stateAfter = useKYStore.getState()
        if (!stateAfter.session) return

        let stateForPendingCheck = stateAfter
        const hasPendingWorkItemForManualCompletion =
            stateAfter.session.workItems.length < 2 &&
            isWorkItemComplete(stateAfter.currentWorkItem)
        if (hasPendingWorkItemForManualCompletion && stateAfter.status !== 'work_items') {
            setStatus('work_items')
            stateForPendingCheck = useKYStore.getState()
        }

        const isFirstPendingAfterUpdate = isFirstWorkItemCompletionPending(
            stateForPendingCheck.status,
            stateForPendingCheck.session?.workItems.length ?? 0,
            stateForPendingCheck.currentWorkItem
        )
        const isSecondPendingAfterUpdate = Boolean(
            stateForPendingCheck.status === 'work_items' &&
            (stateForPendingCheck.session?.workItems.length ?? 0) === 1 &&
            isWorkItemComplete(stateForPendingCheck.currentWorkItem)
        )
        if (isFirstPendingAfterUpdate || isSecondPendingAfterUpdate) {
            const afterMeasureCount = countValidCountermeasures(stateForPendingCheck.currentWorkItem.countermeasures)
            if (beforeMeasureCount < 2 && afterMeasureCount >= 2) {
                if (isSecondPendingAfterUpdate) {
                    addMessage(
                        'assistant',
                        '他に対策はありますか？それとも、行動目標の設定に進みますか？',
                        { nextAction: 'ask_countermeasure' }
                    )
                } else {
                    addMessage(
                        'assistant',
                        '他に何か対策はありますか？それとも、2件目のKYに移りますか？',
                        { nextAction: 'ask_countermeasure' }
                    )
                }
                return
            }

            if (isFirstPendingAfterUpdate && beforeMeasureCount < 3 && afterMeasureCount >= 3) {
                addMessage(
                    'assistant',
                    '3件目の対策を追記しました。続けるには「1件目完了」を押してください。',
                    { nextAction: 'ask_countermeasure' }
                )
            }
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

    const completeSessionFromCurrentState = useCallback((safetyChecks?: SafetyConfirmationChecks | null) => {
        const latest = useKYStore.getState()
        if (!latest.session) return
        if (latest.status === 'completed') return
        if (latest.session.workItems.length < 1) return
        if (!latest.session.actionGoal || latest.session.actionGoal.trim().length === 0) return

        const resolvedSafetyChecks = safetyChecks ?? latest.session.safetyChecks ?? null
        const allSafetyChecksDone = resolvedSafetyChecks
            ? Object.values(resolvedSafetyChecks).every(Boolean)
            : latest.session.allMeasuresImplemented ?? null

        latest.completeSession({
            actionGoal: latest.session.actionGoal,
            pointingConfirmed: resolvedSafetyChecks?.pointAndCall ?? latest.session.pointingConfirmed ?? null,
            safetyChecks: resolvedSafetyChecks,
            allMeasuresImplemented: allSafetyChecksDone,
            hadNearMiss: latest.session.hadNearMiss ?? null,
            nearMissNote: latest.session.nearMissNote ?? null,
        })
    }, [])

    const completeSafetyConfirmation = useCallback((safetyChecks: SafetyConfirmationChecks): boolean => {
        const latest = useKYStore.getState()
        if (!latest.session) return false
        if (latest.status !== 'confirmation') return false
        if (!latest.session.actionGoal || latest.session.actionGoal.trim().length === 0) return false
        completeSessionFromCurrentState(safetyChecks)
        return true
    }, [completeSessionFromCurrentState])

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

    const completeSecondWorkItem = useCallback((): boolean => {
        const latest = useKYStore.getState()
        if (!latest.session) return false
        if (latest.status !== 'work_items') return false
        if (latest.session.workItems.length !== 1) return false
        if (!isWorkItemComplete(latest.currentWorkItem)) {
            latest.setError('作業項目が不完全です（対策は2件以上が必要です）', 'validation')
            return false
        }

        latest.setError(null)
        latest.commitWorkItem({ suppressGoalPrompt: true })

        const afterCommit = useKYStore.getState()
        if (!afterCommit.session) return false
        if (afterCommit.session.workItems.length !== 2) return false

        afterCommit.setStatus('action_goal')
        afterCommit.addMessage(
            'assistant',
            '本日の行動目標を1つ設定してください。',
            { nextAction: 'ask_goal' }
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
                messages: [...buildRequestMessages({
                    messages,
                    text,
                    skipUserMessage: shouldSkipUserMessage,
                    retryAssistantMessage: RETRY_ASSISTANT_MESSAGE,
                })],
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
                    reply: '行動目標を記録しました。続けて最終安全確認（4項目）をチェックしてください。',
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
            if (shouldLogChatErrorToConsole(normalizedError)) {
                console.error('Chat error:', normalizedError)
            }
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
        if (session && status === 'action_goal' && session.workItems.length >= 2 && isKYCompleteCommand(text)) {
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
                    '本日の行動目標を1つ設定してください。',
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
                    '行動目標を記録しました。続けて最終安全確認（4項目）をチェックしてください。',
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
        completeSecondWorkItem,
        applyRiskLevelSelection,
        completeSafetyConfirmation,
        retryLastMessage,
        canRetry,
    }
}
