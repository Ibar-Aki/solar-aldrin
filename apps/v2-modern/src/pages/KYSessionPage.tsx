import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChatInput } from '@/components/ChatInput'
import { ChatBubble } from '@/components/ChatBubble'
import { RiskLevelSelector } from '@/components/RiskLevelSelector'
import { KYBoardCard } from '@/components/KYBoardCard'
import { VoiceConversationModeToggle } from '@/components/VoiceConversationModeToggle'
import { useKYStore } from '@/stores/kyStore'
import { useVoiceConversationModeStore } from '@/stores/useVoiceConversationModeStore'
import { useChat } from '@/hooks/useChat'
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

export function KYSessionPage() {
    const navigate = useNavigate()
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const [kyBoardScale, setKyBoardScale] = useState<'expanded' | 'compact'>('expanded')
    const [safetyChecksDraft, setSafetyChecksDraft] = useState<SafetyConfirmationChecks | null>(null)
    const { mode, setMode } = useVoiceConversationModeStore()

    const WAIT_NOTICE_AFTER_MS = (() => {
        const raw = import.meta.env.VITE_WAIT_NOTICE_AFTER_MS
        if (!raw) return 15_000
        const parsed = Number.parseInt(raw, 10)
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 15_000
    })()

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

    if (!session) return null

    const processPhaseLabel = (session.processPhase ?? 'フリー').trim() || 'フリー'
    const meta2Line = (
        <div className="text-xs sm:text-sm text-gray-500 leading-snug">
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
    const lastAssistantNextAction = (() => {
        for (let i = messages.length - 1; i >= 0; i -= 1) {
            const message = messages[i]
            if (message.role === 'assistant' && message.extractedData?.nextAction) {
                return message.extractedData.nextAction
            }
        }
        return undefined
    })()
    const isRiskLevelSelectorVisible = shouldShowRiskLevelSelector({
        lastAssistantNextAction,
        currentRiskLevel: currentWorkItem.riskLevel,
    })
    const kyBoardIndex = Math.min(2, workItemCount + 1)
    const firstWorkItemMeasureCount = (currentWorkItem.countermeasures ?? [])
        .map((cm) => (typeof cm.text === 'string' ? cm.text.trim() : ''))
        .filter((text) => text.length > 0 && !isNonAnswerText(text))
        .length
    const secondWorkItemMeasureCount = (currentWorkItem.countermeasures ?? [])
        .map((cm) => (typeof cm.text === 'string' ? cm.text.trim() : ''))
        .filter((text) => text.length > 0 && !isNonAnswerText(text))
        .length
    const canShowFirstWorkItemCompleteButton =
        status === 'work_items' &&
        workItemCount === 0 &&
        isWorkItemComplete(currentWorkItem) &&
        firstWorkItemMeasureCount >= 2
    const canShowSecondWorkItemCompleteButton =
        status === 'work_items' &&
        workItemCount === 1 &&
        isWorkItemComplete(currentWorkItem) &&
        secondWorkItemMeasureCount >= 2
    const safetyChecklistItems: Array<{ key: keyof SafetyConfirmationChecks; label: string }> = [
        { key: 'pointAndCall', label: '指差し呼称を実施した。' },
        { key: 'toolAndWireInspection', label: '工具やワイヤーの点検を行った。' },
        { key: 'ppeReady', label: '適切な保護具を準備した。' },
        { key: 'evacuationRouteAndContact', label: '退避経路と連絡手段を確認した。' },
    ]
    const completedSafetyCheckCount = safetyChecklistItems.filter((item) => safetyChecks[item.key]).length
    const isSafetyChecklistComplete = completedSafetyCheckCount === safetyChecklistItems.length
    const shouldHideChatInputForFirstWorkItem =
        canShowFirstWorkItemCompleteButton && firstWorkItemMeasureCount >= 3
    const shouldShowSafetyChecklist = status === 'confirmation'
    const shouldHideChatInput =
        shouldShowSafetyChecklist ||
        shouldHideChatInputForFirstWorkItem

    return (
        <div className="h-screen supports-[height:100dvh]:h-[100dvh] bg-gray-50 flex flex-col overflow-hidden">
            {/* ヘッダー */}
            <div className="shrink-0">
                <div className="bg-white border-b px-4 py-2">
                    <div className="max-w-4xl mx-auto space-y-2">
                        <div className="flex items-start justify-between gap-3">
                            <h1 className="text-base sm:text-lg font-bold text-blue-600">一人KY活動</h1>

                            {/* 右側メタ情報（2行）: 1行目=作業場所,天候 / 2行目=作業内容(工程),ユーザー名 */}
                            <div className="w-[12.5rem] sm:w-64 lg:w-80 min-w-0 text-right text-xs sm:text-sm">
                                {meta2Line}
                            </div>
                        </div>
                        <VoiceConversationModeToggle
                            mode={mode}
                            onChange={setMode}
                            className="rounded-md border border-slate-200 bg-slate-50 p-3"
                        />
                    </div>
                </div>

                {/* 進捗バー */}
                <div className="bg-white border-b px-4 py-1">
                    <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                            <span className={`px-2 py-1 rounded ${status === 'work_items' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'}`}>
                                KY活動
                            </span>
                            <span className="text-gray-300">→</span>
                            <span className={`px-2 py-1 rounded ${status === 'action_goal' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'}`}>
                                安全確認
                            </span>
                            <span className="text-gray-300">→</span>
                            <span className={`px-2 py-1 rounded ${status === 'confirmation' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'}`}>
                                総括
                            </span>
                        </div>
                        <Button
                            asChild
                            size="sm"
                            className="shrink-0 h-8 px-2.5 text-xs font-semibold shadow-sm"
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
                    <div className="bg-white border-b px-4 py-1">
                        <div className="max-w-4xl mx-auto w-full">
                            <Alert>
                                <AlertDescription>
                                    ⚠️ {session.environmentRisk}
                                </AlertDescription>
                            </Alert>
                        </div>
                    </div>
                )}

                {/* KYボード（作業・危険フェーズ中） */}
                {status === 'work_items' && (
                    <div className="bg-gray-50 border-b px-4 py-1">
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
                        <ChatBubble key={msg.id} message={msg} autoSpeak={mode === 'full_voice'} />
                    ))}
                    {isLoading && (
                        <div className="flex justify-start mb-3">
                            <div className="bg-gray-100 rounded-2xl px-4 py-2">
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
                            <div className="bg-amber-50 text-amber-900 border border-amber-200 rounded-2xl px-4 py-2">
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
            <div className="shrink-0 bg-white border-t pb-[env(safe-area-inset-bottom)]">
                {/* 危険度選択（AIが危険度を聞いているとき） */}
                {isRiskLevelSelectorVisible && (
                    <div className="px-4 py-2 border-b">
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
                    <div className="px-4 py-2 border-b">
                        <div className="max-w-4xl mx-auto">
                            <Button
                                type="button"
                                onClick={handleCompleteFirstWorkItem}
                                className="w-full"
                                data-testid="button-complete-first-work-item"
                            >
                                1件目完了
                            </Button>
                        </div>
                    </div>
                )}

                {canShowSecondWorkItemCompleteButton && (
                    <div className="px-4 py-2 border-b">
                        <div className="max-w-4xl mx-auto">
                            <Button
                                type="button"
                                onClick={handleCompleteSecondWorkItem}
                                className="w-full"
                                data-testid="button-complete-second-work-item"
                            >
                                2件目完了
                            </Button>
                        </div>
                    </div>
                )}

                {shouldShowSafetyChecklist && (
                    <div className="px-4 py-2 border-b bg-slate-50" data-testid="safety-checklist-panel">
                        <div className="max-w-4xl mx-auto">
                            <Card className="gap-2 py-3">
                                <CardHeader className="py-1.5">
                                    <CardTitle className="text-sm">
                                        最終安全確認 ({completedSafetyCheckCount}/{safetyChecklistItems.length})
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-0 space-y-2">
                                    {safetyChecklistItems.map((item) => {
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
                                                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                                        : 'border-slate-200 bg-white text-slate-700'
                                                }`}
                                            >
                                                <span
                                                    className={`inline-flex h-5 w-5 items-center justify-center rounded border text-xs ${
                                                        checked
                                                            ? 'border-emerald-500 bg-emerald-500 text-white'
                                                            : 'border-slate-300 bg-white text-transparent'
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
                                        className="w-full"
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
                    <div className="px-4 py-2 border-b border-red-100 bg-red-50">
                        <div className="max-w-4xl mx-auto text-red-600 text-sm flex items-center justify-between gap-2">
                            <span>{error}</span>
                            {errorSource === 'chat' && canRetry && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={retryLastMessage}
                                    disabled={isLoading}
                                    className="shrink-0 border-red-200 text-red-700 hover:bg-red-100"
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
                    <div className="px-3 sm:px-4 py-1.5 sm:py-2">
                        <div className="max-w-4xl mx-auto w-full">
                            <ChatInput
                                onSend={handleSend}
                                disabled={isLoading}
                                placeholder="メッセージを入力..."
                                variant="bare"
                                voiceMode={mode}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
