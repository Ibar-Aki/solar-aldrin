import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChatInput } from '@/components/ChatInput'
import { ChatBubble } from '@/components/ChatBubble'
import { RiskLevelSelector } from '@/components/RiskLevelSelector'
import { KYBoardCard } from '@/components/KYBoardCard'
import { VoiceConversationModeToggle } from '@/components/VoiceConversationModeToggle'
import { useKYStore } from '@/stores/kyStore'
import { useTTSStore } from '@/stores/useTTSStore'
import { useVoiceConversationModeStore } from '@/stores/useVoiceConversationModeStore'
import { useChat } from '@/hooks/useChat'
import { useTTS } from '@/hooks/useTTS'
import { shouldShowRiskLevelSelector } from '@/lib/riskLevelVisibility'
import { isWorkItemComplete } from '@/lib/validation'
import { isNonAnswerText } from '@/lib/nonAnswer'
import type { SafetyConfirmationChecks } from '@/types/ky'

const DEFAULT_SAFETY_CHECKS: SafetyConfirmationChecks = {
    pointAndCall: false,
    toolAndWireInspection: false,
    ppeReady: false,
    evacuationRouteAndContact: false,
}

const SAFETY_CHECKLIST_ITEMS: Array<{ key: keyof SafetyConfirmationChecks; label: string }> = [
    { key: 'pointAndCall', label: '指差し呼称を実施した。' },
    { key: 'toolAndWireInspection', label: '工具やワイヤーの点検を行った。' },
    { key: 'ppeReady', label: '適切な保護具を準備した。' },
    { key: 'evacuationRouteAndContact', label: '退避経路と連絡手段を確認した。' },
]

const WAIT_NOTICE_AFTER_MS = (() => {
    const raw = import.meta.env.VITE_WAIT_NOTICE_AFTER_MS
    if (!raw) return 15_000
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 15_000
})()

type SessionEntry = 'new' | 'resume'
const INITIAL_VOICE_FALLBACK_MS = 6_000

function getSessionEntryFromState(state: unknown): SessionEntry | null {
    if (!state || typeof state !== 'object') return null
    const entry = (state as { entry?: unknown }).entry
    return entry === 'new' || entry === 'resume' ? entry : null
}

export function KYSessionPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const [kyBoardScale, setKyBoardScale] = useState<'expanded' | 'compact'>('expanded')
    const [safetyChecksDraft, setSafetyChecksDraft] = useState<SafetyConfirmationChecks | null>(null)
    const { mode, setMode } = useVoiceConversationModeStore()
    const isTTSSpeaking = useTTSStore((state) => state.isSpeaking)

    const sessionEntry = getSessionEntryFromState(location.state)
    const [isInitialVoiceBootPending, setIsInitialVoiceBootPending] = useState(
        mode === 'full_voice' && sessionEntry !== null
    )
    const bootSpeechObservedRef = useRef(false)
    const bootGuideBlockedRef = useRef(false)
    const resumeGuideTriggeredRef = useRef(false)

    const handleInitialGuideTtsError = useCallback((errorCode: string) => {
        if (!errorCode) return
        if (errorCode !== 'not-allowed') return
        bootGuideBlockedRef.current = true
        setIsInitialVoiceBootPending(false)
    }, [])

    const { speak: speakInitialGuide, isSupported: isTTSSupported } = useTTS({
        messageId: 'session-voice-boot',
        onTtsError: handleInitialGuideTtsError,
    })

    const {
        session,
        messages,
        currentWorkItem,
        status,
        isLoading,
        error,
        errorSource,
    } = useKYStore()

    const {
        sendMessage,
        completeFirstWorkItem,
        completeSecondWorkItem,
        applyRiskLevelSelection,
        completeSafetyConfirmation,
        initializeChat,
        retryLastMessage,
        canRetry,
    } = useChat()
    const [autoSpeakFromTimestamp] = useState(() => {
        if (sessionEntry !== 'resume') return 0
        const latestTimestamp = messages.reduce((latest, message) => {
            const parsed = Date.parse(message.timestamp)
            return Number.isFinite(parsed) ? Math.max(latest, parsed) : latest
        }, 0)
        return latestTimestamp + 1
    })

    // セッションがない場合はホームに戻る
    useEffect(() => {
        if (!session) {
            navigate('/')
        }
    }, [session, navigate])

    // ストア状態でセッション完了になった場合は自動で完了画面へ遷移
    useEffect(() => {
        if (!session) return
        if (status === 'completed') {
            navigate('/complete')
        }
    }, [session, status, navigate])

    // 初回メッセージ
    const initialized = useRef(false)
    useEffect(() => {
        if (session && messages.length === 0 && !initialized.current) {
            initialized.current = true
            initializeChat()
        }
    }, [session, messages.length, initializeChat])

    useEffect(() => {
        if (!isInitialVoiceBootPending) return
        if (mode === 'full_voice') return

        const timer = window.setTimeout(() => {
            setIsInitialVoiceBootPending(false)
        }, 0)
        return () => window.clearTimeout(timer)
    }, [mode, isInitialVoiceBootPending])

    useEffect(() => {
        if (!isInitialVoiceBootPending) return
        if (isTTSSupported) return

        const timer = window.setTimeout(() => {
            setIsInitialVoiceBootPending(false)
        }, 0)
        return () => window.clearTimeout(timer)
    }, [isInitialVoiceBootPending, isTTSSupported])

    useEffect(() => {
        if (!isInitialVoiceBootPending) return
        if (!session) return
        if (mode !== 'full_voice') return
        if (sessionEntry !== 'resume') return
        if (resumeGuideTriggeredRef.current) return

        resumeGuideTriggeredRef.current = true
        const phase = (session.processPhase ?? 'フリー').trim() || 'フリー'
        speakInitialGuide(`KY活動を再開します。${phase}の続きから進めましょう。準備ができたら話しかけてください。`)
    }, [isInitialVoiceBootPending, mode, session, sessionEntry, speakInitialGuide])

    useEffect(() => {
        if (!isInitialVoiceBootPending) return
        if (bootGuideBlockedRef.current) return

        const timer = window.setTimeout(() => {
            setIsInitialVoiceBootPending(false)
        }, INITIAL_VOICE_FALLBACK_MS)

        return () => window.clearTimeout(timer)
    }, [isInitialVoiceBootPending])

    useEffect(() => {
        if (!isInitialVoiceBootPending) return

        if (isTTSSpeaking) {
            bootSpeechObservedRef.current = true
            return
        }

        if (bootSpeechObservedRef.current) {
            const timer = window.setTimeout(() => {
                setIsInitialVoiceBootPending(false)
            }, 0)
            return () => window.clearTimeout(timer)
        }
    }, [isTTSSpeaking, isInitialVoiceBootPending])

    // メッセージ追加時にスクロール
    useEffect(() => {
        if (!messagesEndRef.current) return

        const id = requestAnimationFrame(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
        })
        return () => cancelAnimationFrame(id)
    }, [messages])

    const handleSend = async (text: string) => {
        await sendMessage(text)
    }

    const handleRiskLevelChange = (level: 1 | 2 | 3 | 4 | 5) => {
        applyRiskLevelSelection(level)
    }

    const handleCompleteFirstWorkItem = () => {
        completeFirstWorkItem()
    }

    const handleCompleteSecondWorkItem = () => {
        completeSecondWorkItem()
    }

    const safetyChecks = safetyChecksDraft ?? session?.safetyChecks ?? DEFAULT_SAFETY_CHECKS

    const toggleSafetyCheck = (key: keyof SafetyConfirmationChecks) => {
        setSafetyChecksDraft((prev) => {
            const base = prev ?? session?.safetyChecks ?? DEFAULT_SAFETY_CHECKS
            return { ...base, [key]: !base[key] }
        })
    }

    const handleCompleteSafetyConfirmation = () => {
        if (!Object.values(safetyChecks).every(Boolean)) return
        completeSafetyConfirmation(safetyChecks)
    }

    const processPhaseLabel = useMemo(
        () => (session?.processPhase ?? 'フリー').trim() || 'フリー',
        [session?.processPhase]
    )
    const lastAssistantNextAction = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i -= 1) {
            const message = messages[i]
            if (message.role === 'assistant' && message.extractedData?.nextAction) {
                return message.extractedData.nextAction
            }
        }
        return undefined
    }, [messages])
    if (!session) return null

    const meta2Line = (
        <div className="text-xs sm:text-sm text-[var(--text-muted)] leading-snug">
            <div className="flex min-w-0 items-center justify-end gap-1">
                <span className="min-w-0 truncate">{session.siteName}</span>
                <span className="shrink-0">｜{session.weather}</span>
            </div>
            <div className="flex min-w-0 items-center justify-end gap-1">
                <span className="min-w-0 truncate">{processPhaseLabel}</span>
                <span className="shrink-0">｜{session.userName}</span>
            </div>
        </div>
    )

    // 作業項目の進捗表示
    const workItemCount = session.workItems.length
    const isRiskLevelSelectorVisible = shouldShowRiskLevelSelector({
        lastAssistantNextAction,
        currentRiskLevel: currentWorkItem.riskLevel,
    })
    const kyBoardIndex = Math.min(2, workItemCount + 1)
    const validMeasureCount = (currentWorkItem.countermeasures ?? [])
        .map((cm) => (typeof cm.text === 'string' ? cm.text.trim() : ''))
        .filter((text) => text.length > 0 && !isNonAnswerText(text))
        .length
    const canShowFirstWorkItemCompleteButton =
        status === 'work_items' &&
        workItemCount === 0 &&
        isWorkItemComplete(currentWorkItem) &&
        validMeasureCount >= 2
    const canShowSecondWorkItemCompleteButton =
        status === 'work_items' &&
        workItemCount === 1 &&
        isWorkItemComplete(currentWorkItem) &&
        validMeasureCount >= 2
    const completedSafetyCheckCount = SAFETY_CHECKLIST_ITEMS.filter((item) => safetyChecks[item.key]).length
    const isSafetyChecklistComplete = completedSafetyCheckCount === SAFETY_CHECKLIST_ITEMS.length
    const shouldHideChatInputForFirstWorkItem =
        canShowFirstWorkItemCompleteButton && validMeasureCount >= 3
    const shouldShowSafetyChecklist = status === 'confirmation'
    const shouldHideChatInput =
        shouldShowSafetyChecklist ||
        shouldHideChatInputForFirstWorkItem
    const micAutoStartEnabled = mode !== 'full_voice' || !isInitialVoiceBootPending
    const shouldAutoSpeakMessage = (timestamp: string) => {
        if (mode !== 'full_voice') return false
        if (isInitialVoiceBootPending) return false
        const parsed = Date.parse(timestamp)
        if (!Number.isFinite(parsed)) return true
        return parsed >= autoSpeakFromTimestamp
    }

    return (
        <div className="h-screen supports-[height:100dvh]:h-[100dvh] bg-[var(--surface-page)] flex flex-col overflow-hidden">
            {/* ヘッダー */}
            <div className="shrink-0">
                <div className="bg-[var(--surface-card)] border-b border-[color:var(--surface-border)] px-4 py-2">
                    <div className="max-w-4xl mx-auto">
                        <div className="flex items-start justify-between gap-3">
                            <h1 className="text-base sm:text-lg font-bold text-[var(--accent-royal-600)]">一人KY活動</h1>

                            {/* 右側メタ情報（2行）: 1行目=作業場所,天候 / 2行目=作業内容(工程),ユーザー名 */}
                            <div className="w-[12.5rem] sm:w-64 lg:w-80 min-w-0 text-right text-xs sm:text-sm">
                                {meta2Line}
                            </div>
                        </div>
                    </div>
                </div>

                {/* モード切替 + 参考情報（高さ固定） */}
                <div className="bg-[var(--surface-card)] border-b border-[color:var(--surface-border)] px-4 py-1">
                    <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1" data-testid="session-mode-toggle-compact">
                            <VoiceConversationModeToggle
                                mode={mode}
                                onChange={setMode}
                                density="compact"
                            />
                        </div>
                        <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="shrink-0 h-8 border-[color:var(--surface-border)] bg-[var(--surface-card)] px-2.5 text-xs font-semibold text-[var(--accent-royal-600)] shadow-xs hover:bg-[var(--brand-50)]"
                            data-testid="button-reference-info"
                        >
                            <a
                                href="https://www.mlit.go.jp/common/001187973.pdf"
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="参考情報（国土交通省PDF）を開く"
                            >
                                参考情報
                            </a>
                        </Button>
                    </div>
                </div>

                {/* 環境リスク */}
                {session.environmentRisk && (
                    <div className="bg-[var(--surface-card)] border-b border-[color:var(--surface-border)] px-4 py-1">
                        <div className="max-w-4xl mx-auto w-full">
                            <Alert className="border-[color:var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning-text)]">
                                <AlertDescription>
                                    ⚠ {session.environmentRisk}
                                </AlertDescription>
                            </Alert>
                        </div>
                    </div>
                )}

                {/* KYボード（作業・危険フェーズ中） */}
                {status === 'work_items' && (
                    <div className="bg-[var(--surface-muted)] border-b border-[color:var(--surface-border)] px-4 py-1">
                        <div className="max-w-4xl mx-auto w-full">
                            <KYBoardCard
                                currentWorkItem={currentWorkItem}
                                workItemIndex={kyBoardIndex}
                                boardScale={kyBoardScale}
                                onBoardScaleChange={setKyBoardScale}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* チャットエリア */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-3">
                <div className="max-w-4xl mx-auto">
                    {messages.map((msg) => (
                        <ChatBubble key={msg.id} message={msg} autoSpeak={shouldAutoSpeakMessage(msg.timestamp)} />
                    ))}
                    {isLoading && (
                        <div className="flex justify-start mb-3">
                            <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-card)] px-4 py-2 text-slate-700">
                                <span className="animate-pulse">考え中...</span>
                            </div>
                        </div>
                    )}
                    {isLoading && (
                        <div
                            className="flex justify-start mb-3 opacity-0 animate-[waitNoticeShow_1ms_linear_forwards]"
                            style={{ animationDelay: `${WAIT_NOTICE_AFTER_MS}ms` }}
                            data-testid="notice-wait-over-15s"
                        >
                            <div className="rounded-2xl border border-[color:var(--warning-border)] bg-[var(--warning-bg)] px-4 py-2 text-[var(--warning-text)]">
                                <span className="text-sm">
                                    応答に{Math.ceil(WAIT_NOTICE_AFTER_MS / 1000)}秒以上かかっています。混雑している可能性があります。このままお待ちください。
                                </span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* フッター固定エリア */}
            <div className="shrink-0 bg-[var(--surface-card)] border-t border-[color:var(--surface-border)] pb-[env(safe-area-inset-bottom)]">
                {/* 危険度選択（AIが危険度を聞いているとき） */}
                {isRiskLevelSelectorVisible && (
                    <div className="border-b border-[color:var(--surface-border)] px-4 py-2">
                        <div className="max-w-4xl mx-auto">
                            <RiskLevelSelector
                                value={currentWorkItem.riskLevel}
                                onChange={handleRiskLevelChange}
                                disabled={isLoading}
                            />
                        </div>
                    </div>
                )}

                {canShowFirstWorkItemCompleteButton && (
                    <div className="border-b border-[color:var(--surface-border)] px-4 py-2">
                        <div className="max-w-4xl mx-auto">
                            <Button
                                type="button"
                                onClick={handleCompleteFirstWorkItem}
                                className="w-full bg-[var(--brand-600)] text-[var(--brand-foreground)] hover:bg-[var(--brand-700)]"
                                data-testid="button-complete-first-work-item"
                            >
                                1件目完了
                            </Button>
                        </div>
                    </div>
                )}

                {canShowSecondWorkItemCompleteButton && (
                    <div className="border-b border-[color:var(--surface-border)] px-4 py-2">
                        <div className="max-w-4xl mx-auto">
                            <Button
                                type="button"
                                onClick={handleCompleteSecondWorkItem}
                                className="w-full bg-[var(--brand-600)] text-[var(--brand-foreground)] hover:bg-[var(--brand-700)]"
                                data-testid="button-complete-second-work-item"
                            >
                                2件目完了
                            </Button>
                        </div>
                    </div>
                )}

                {shouldShowSafetyChecklist && (
                    <div className="border-b border-[color:var(--surface-border)] bg-[var(--surface-muted)] px-4 py-2" data-testid="safety-checklist-panel">
                        <div className="max-w-4xl mx-auto">
                            <Card className="gap-2 border-[color:var(--surface-border)] bg-[var(--surface-card)] py-3 shadow-xs">
                                <CardHeader className="py-1.5">
                                    <CardTitle className="text-sm text-slate-800">
                                        最終安全確認 ({completedSafetyCheckCount}/{SAFETY_CHECKLIST_ITEMS.length})
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-0 space-y-2">
                                    {SAFETY_CHECKLIST_ITEMS.map((item) => {
                                        const checked = safetyChecks[item.key]
                                        return (
                                            <button
                                                key={item.key}
                                                type="button"
                                                onClick={() => toggleSafetyCheck(item.key)}
                                                aria-pressed={checked}
                                                data-testid={`safety-check-${item.key}`}
                                                className={`w-full flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm ${
                                                    checked
                                                        ? 'border-[color:var(--success-border)] bg-[var(--success-bg)] text-[var(--success-text)]'
                                                        : 'border-[color:var(--surface-border)] bg-[var(--surface-card)] text-slate-700'
                                                }`}
                                            >
                                                <span
                                                    className={`inline-flex h-5 w-5 items-center justify-center rounded border text-xs ${
                                                        checked
                                                            ? 'border-[color:var(--success-border)] bg-[var(--success-text)] text-white'
                                                            : 'border-[color:var(--surface-border)] bg-[var(--surface-card)] text-transparent'
                                                    }`}
                                                    aria-hidden="true"
                                                >
                                                    ✓
                                                </span>
                                                <span>{item.label}</span>
                                            </button>
                                        )
                                    })}
                                    <Button
                                        type="button"
                                        onClick={handleCompleteSafetyConfirmation}
                                        disabled={!isSafetyChecklistComplete}
                                        className="w-full bg-[var(--brand-600)] text-[var(--brand-foreground)] hover:bg-[var(--brand-700)] disabled:bg-[var(--brand-200)]"
                                        data-testid="button-complete-safety-checks"
                                    >
                                        確認OKで完了画面へ進む
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                {/* エラー表示 */}
                {error && (
                    <div className="border-b border-[color:var(--danger-border)] bg-[var(--danger-bg)] px-4 py-2">
                        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2 text-sm text-[var(--danger-text)]">
                            <span>{error}</span>
                            {errorSource === 'chat' && canRetry && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={retryLastMessage}
                                    disabled={isLoading}
                                    className="shrink-0 border-[color:var(--danger-border)] bg-[var(--surface-card)] text-[var(--danger-text)] hover:bg-[var(--danger-bg)]"
                                    data-testid="button-retry"
                                >
                                    リトライ
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {/* 入力エリア */}
                {!shouldHideChatInput && (
                    <div className="px-3 py-1.5 sm:px-4 sm:py-2">
                        <div className="max-w-4xl mx-auto w-full">
                            <ChatInput
                                onSend={handleSend}
                                disabled={isLoading}
                                placeholder="メッセージを入力..."
                                variant="bare"
                                voiceMode={mode}
                                micAutoStartEnabled={micAutoStartEnabled}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
