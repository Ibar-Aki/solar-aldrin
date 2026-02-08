import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ChatInput } from '@/components/ChatInput'
import { ChatBubble } from '@/components/ChatBubble'
import { RiskLevelSelector } from '@/components/RiskLevelSelector'
import { ConfirmedInfoCard } from '@/components/ConfirmedInfoCard'
import { useKYStore } from '@/stores/kyStore'
import { useChat } from '@/hooks/useChat'
import { shouldShowRiskLevelSelector } from '@/lib/riskLevelVisibility'

export function KYSessionPage() {
    const navigate = useNavigate()
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const [isMetaOpen, setIsMetaOpen] = useState(false)

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
        updateCurrentWorkItem,
        completeSession,
    } = useKYStore()

    const { sendMessage, initializeChat, retryLastMessage, canRetry } = useChat()

    // セッションがない場合はホームに戻る
    useEffect(() => {
        if (!session) {
            navigate('/')
        }
    }, [session, navigate])

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
        updateCurrentWorkItem({ riskLevel: level })
        sendMessage(`危険度は${level}です`)
    }

    const handleChangeCountermeasureCategory = (index: number, category: 'ppe' | 'behavior' | 'equipment') => {
        const list = currentWorkItem.countermeasures ?? []
        if (index < 0 || index >= list.length) return
        const next = list.map((cm, i) => (i === index ? { ...cm, category } : cm))
        updateCurrentWorkItem({ countermeasures: next })
    }

    const handleComplete = () => {
        if (!session) return
        completeSession({
            actionGoal: session.actionGoal ?? null,
            pointingConfirmed: session.pointingConfirmed ?? null,
            allMeasuresImplemented: session.allMeasuresImplemented ?? null,
            hadNearMiss: session.hadNearMiss ?? null,
            nearMissNote: session.nearMissNote ?? null,
        })
        navigate('/complete')
    }

    if (!session) return null

    const processPhaseLabel = (session.processPhase ?? 'フリー').trim() || 'フリー'
    const meta2Line = (
        <div className="text-sm text-gray-500 leading-snug">
            <div className="flex min-w-0 items-center justify-end gap-1">
                <span className="min-w-0 truncate">{session.siteName}</span>
                <span className="shrink-0">、{session.weather}</span>
            </div>
            <div className="flex min-w-0 items-center justify-end gap-1">
                <span className="min-w-0 truncate">{processPhaseLabel}</span>
                <span className="shrink-0">、{session.userName}</span>
            </div>
        </div>
    )

    // 作業項目の進捗表示
    const workItemCount = session.workItems.length
    const hasCurrentWork = !!(currentWorkItem.workDescription || currentWorkItem.hazardDescription)
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

    return (
        <div className="h-screen supports-[height:100dvh]:h-[100dvh] bg-gray-50 flex flex-col overflow-hidden">
            {/* ヘッダー */}
            <div className="shrink-0">
                <div className="bg-white border-b px-4 py-2">
                    <div className="max-w-4xl mx-auto flex items-start justify-between gap-3">
                        <h1 className="text-lg font-bold text-blue-600">一人KY活動</h1>

                        {/* 右側メタ情報（2行）: 1行目=作業場所,天候 / 2行目=作業内容(工程),ユーザー名 */}
                        <div className="hidden lg:block w-80 min-w-0 text-right">
                            {meta2Line}
                        </div>

                        {/* 小さい画面では折りたたみ */}
                        <div className="lg:hidden">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsMetaOpen((v) => !v)}
                                className="text-gray-600"
                                aria-expanded={isMetaOpen}
                                aria-controls="ky-session-meta"
                            >
                                情報
                                {isMetaOpen ? <ChevronUp /> : <ChevronDown />}
                            </Button>
                        </div>
                    </div>

                    {isMetaOpen && (
                        <div className="pt-2 lg:hidden" id="ky-session-meta">
                            <div className="max-w-4xl mx-auto">
                                {meta2Line}
                            </div>
                        </div>
                    )}
                </div>

                {/* 進捗バー */}
                <div className="bg-white border-b px-4 py-1">
                    <div className="max-w-4xl mx-auto flex items-center gap-2 text-sm">
                        <span className={`px-2 py-1 rounded ${status === 'work_items' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'}`}>
                            作業・危険 ({workItemCount}件)
                        </span>
                        <span className="text-gray-300">→</span>
                        <span className={`px-2 py-1 rounded ${status === 'action_goal' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'}`}>
                            行動目標
                        </span>
                        <span className="text-gray-300">→</span>
                        <span className={`px-2 py-1 rounded ${status === 'confirmation' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'}`}>
                            確認
                        </span>
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

                {/* 確認済み情報カード（対策カテゴリ進捗） */}
                <div className="bg-gray-50 border-b px-4 py-1">
                    <div className="max-w-4xl mx-auto w-full">
                        <ConfirmedInfoCard
                            currentWorkItem={currentWorkItem}
                            disabled={isLoading}
                            onChangeCountermeasureCategory={handleChangeCountermeasureCategory}
                        />
                    </div>
                </div>
            </div>

            {/* チャットエリア */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-3">
                <div className="max-w-4xl mx-auto">
                    {messages.map((msg) => (
                        <ChatBubble key={msg.id} message={msg} />
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

                {/* 完了ボタン（すべての作業が終わったら表示） */}
                {workItemCount > 0 && status === 'work_items' && !hasCurrentWork && (
                    <div className="px-4 py-2 border-b">
                        <div className="max-w-4xl mx-auto">
                            <Button onClick={handleComplete} className="w-full" data-testid="button-complete-session">
                                行動目標を決めて終了する
                            </Button>
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
                <div className="px-4 py-2">
                    <div className="max-w-4xl mx-auto w-full">
                        <ChatInput
                            onSend={handleSend}
                            disabled={isLoading}
                            placeholder="メッセージを入力..."
                            variant="bare"
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
