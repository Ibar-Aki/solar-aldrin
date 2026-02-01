/**
 * チャットフック
 * OpenAI APIとの通信を管理
 */
import { useCallback } from 'react'
import { useKYStore } from '@/stores/kyStore'
import { client } from '@/lib/api'
import { mergeExtractedData } from '@/lib/chat/mergeExtractedData'
import type { ExtractedData } from '@/types/ky'

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
    const sendMessage = useCallback(async (text: string) => {
        if (!session) return

        setLoading(true)
        setError(null)

        // ユーザーメッセージを追加
        addMessage('user', text)

        try {
            if (!import.meta.env.VITE_API_TOKEN) {
                throw new Error('APIトークンが設定されていません。環境変数VITE_API_TOKENを確認してください。')
            }

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
                    'Authorization': `Bearer ${import.meta.env.VITE_API_TOKEN}`,
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
