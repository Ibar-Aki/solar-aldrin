import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ChatInput } from '@/components/ChatInput'
import { ChatBubble } from '@/components/ChatBubble'
import { RiskLevelSelector } from '@/components/RiskLevelSelector'
import { useKYStore } from '@/stores/kyStore'
import { useChat } from '@/hooks/useChat'
import { shouldShowRiskLevelSelector } from '@/lib/riskLevelVisibility'

export function KYSessionPage() {
    const navigate = useNavigate()
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const {
        session,
        messages,
        currentWorkItem,
        status,
        isLoading,
        error,
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
                    <div className="max-w-2xl mx-auto">
                        <h1 className="text-lg font-bold text-blue-600">一人KY活動</h1>
                        <p className="text-sm text-gray-500">
                            {session.siteName} | {session.weather} | {session.userName}
                        </p>
                    </div>
                </div>

                {/* 進捗バー */}
                <div className="bg-white border-b px-4 py-1">
                    <div className="max-w-2xl mx-auto flex items-center gap-2 text-sm">
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
                        <div className="max-w-2xl mx-auto w-full">
                            <Alert>
                                <AlertDescription>
                                    ⚠️ {session.environmentRisk}
                                </AlertDescription>
                            </Alert>
                        </div>
                    </div>
                )}
            </div>

            {/* チャットエリア */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-3">
                <div className="max-w-2xl mx-auto">
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
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* フッター固定エリア */}
            <div className="shrink-0 bg-white border-t pb-[env(safe-area-inset-bottom)]">
                {/* 危険度選択（AIが危険度を聞いているとき） */}
                {isRiskLevelSelectorVisible && (
                    <div className="px-4 py-2 border-b">
                        <div className="max-w-2xl mx-auto">
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
                        <div className="max-w-2xl mx-auto">
                            <Button onClick={handleComplete} className="w-full" data-testid="button-complete-session">
                                行動目標を決めて終了する
                            </Button>
                        </div>
                    </div>
                )}

                {/* エラー表示 */}
                {error && (
                    <div className="px-4 py-2 border-b border-red-100 bg-red-50">
                        <div className="max-w-2xl mx-auto text-red-600 text-sm flex items-center justify-between gap-2">
                            <span>{error}</span>
                            {canRetry && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={retryLastMessage}
                                    disabled={isLoading}
                                    className="shrink-0 border-red-200 text-red-700 hover:bg-red-100"
                                >
                                    リトライ
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {/* 入力エリア */}
                <div className="px-4 py-2">
                    <div className="max-w-2xl mx-auto w-full">
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
