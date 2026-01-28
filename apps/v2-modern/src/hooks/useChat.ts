/**
 * チャットフック
 * OpenAI APIとの通信を管理
 */
import { useCallback } from 'react'
import { useKYStore } from '@/stores/kyStore'
import { client } from '@/lib/api'
import { isWorkItemComplete } from '@/lib/validation'
import type { ExtractedData, WorkItem } from '@/types/ky'

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

    /**
     * 初期メッセージを送信
     */
    const initializeChat = useCallback(async () => {
        if (!session) return

        // 環境リスクの設定（天候ベース）
        const weatherRisks: Record<string, string> = {
            '雨': '雨天時は足場が滑りやすくなります。転倒・転落に注意してください。',
            '雪': '積雪・凍結により足場が非常に滑りやすくなっています。慎重に作業してください。',
            '強風': '強風時は高所作業に注意が必要です。資材の飛散にも気をつけてください。',
        }

        if (session.weather in weatherRisks) {
            setEnvironmentRisk(weatherRisks[session.weather])
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
    const handleExtractedData = useCallback((data: ExtractedData) => {
        if (!data) return

        const workItemPatch: Partial<WorkItem> = {}

        // 基本情報の更新
        if (typeof data.workDescription === 'string' && data.workDescription.trim().length > 0) {
            workItemPatch.workDescription = data.workDescription
        }
        if (typeof data.hazardDescription === 'string' && data.hazardDescription.trim().length > 0) {
            workItemPatch.hazardDescription = data.hazardDescription
        }
        if (typeof data.riskLevel === 'number') {
            workItemPatch.riskLevel = data.riskLevel
        }
        if (typeof data.actionGoal === 'string' && data.actionGoal.trim().length > 0) {
            updateActionGoal(data.actionGoal)
        }

        // リスト項目の追加（重複排除）
        if (data.whyDangerous && data.whyDangerous.length > 0) {
            const merged = [
                ...(currentWorkItem.whyDangerous ?? []),
                ...data.whyDangerous,
            ].filter((value, index, self) => self.indexOf(value) === index)
            workItemPatch.whyDangerous = merged
        }

        if (data.countermeasures && data.countermeasures.length > 0) {
            const merged = [
                ...(currentWorkItem.countermeasures ?? []),
                ...data.countermeasures,
            ].filter((value, index, self) => self.indexOf(value) === index)
            workItemPatch.countermeasures = merged
        }

        if (Object.keys(workItemPatch).length > 0) {
            updateCurrentWorkItem(workItemPatch)
        }

        // 完了判定：次のアクションが「詳細確認完了(confirm)」や「次の作業へ(ask_more_work)」の場合
        if (data.nextAction === 'ask_more_work' ||
            data.nextAction === 'ask_goal' ||
            data.nextAction === 'confirm' ||
            data.nextAction === 'completed') {
            const candidate = { ...currentWorkItem, ...workItemPatch }
            if (isWorkItemComplete(candidate)) {
                commitWorkItem()
            }
        }

    }, [updateCurrentWorkItem, commitWorkItem, updateActionGoal, currentWorkItem])

    /**
     * メッセージを送信してAI応答を取得
     */
    const sendMessage = useCallback(async (text: string) => {
        if (!session) return

        setLoading(true)
        setError(null)

        // ユーザーメッセージを追加
        addMessage('user', text)

        try {
            // Hono RPC呼び出し (cast client to stringify types if there is mismatch)
            const res = await client.api.chat.$post({
                json: {
                    messages: [
                        ...messages.map(m => ({ role: m.role, content: m.content })),
                        { role: 'user' as const, content: text },
                    ],
                    sessionContext: {
                        userName: session.userName,
                        siteName: session.siteName,
                        weather: session.weather,
                        workItemCount: session.workItems.length,
                    },
                },
                header: {
                    'Authorization': `Bearer ${import.meta.env.VITE_API_TOKEN || ''}`,
                }
            })

            if (!res.ok) {
                const errorData = await res.json()
                throw new Error((errorData as { error?: string }).error || 'AI応答の取得に失敗しました')
            }

            const data = await res.json()

            // AI応答を追加 (extractedDataも含めて保存)
            addMessage('assistant', data.reply, data.extracted)

            // ストアの更新
            handleExtractedData(data.extracted)

        } catch (e) {
            console.error('Chat error:', e)
            setError(e instanceof Error ? e.message : '通信エラーが発生しました')
            // エラー時もAIメッセージを追加（再試行を促す）
            addMessage('assistant', '申し訳ありません、応答に失敗しました。もう一度お試しください。')
        } finally {
            setLoading(false)
        }
    }, [session, messages, addMessage, setLoading, setError, handleExtractedData])

    return {
        initializeChat,
        sendMessage,
    }
}
