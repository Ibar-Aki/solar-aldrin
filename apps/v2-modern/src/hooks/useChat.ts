/**
 * チャットフック
 * OpenAI APIとの通信を管理
 */
import { useCallback } from 'react'
import { useKYStore } from '@/stores/kyStore'

// API URL（Vite Proxyを使用するため常に相対パス）

export function useChat() {
    const {
        session,
        messages,
        currentWorkItem,
        addMessage,
        updateCurrentWorkItem,
        commitWorkItem,
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
            `${session.userName}さん、今日も安全に作業しましょう！\n\n${session.siteName}での作業ですね。天候は${session.weather}です。\n\nまず、今日行う作業内容を教えてください。`
        )
    }, [session, addMessage, setEnvironmentRisk])

    /**
     * 会話から情報を抽出してストアを更新
     */
    const extractAndUpdateData = useCallback(async (userText: string, aiReply: string) => {
        // 簡易的なキーワードベースの抽出
        const lowerAi = aiReply.toLowerCase()

        // 作業内容の検出
        if (!currentWorkItem.workDescription &&
            (lowerAi.includes('作業') || lowerAi.includes('危険')) &&
            !lowerAi.includes('行動目標')) {
            // 最初のユーザー入力を作業内容として設定
            if (messages.length <= 2) {
                updateCurrentWorkItem({ workDescription: userText })
            }
        }

        // 危険内容の検出
        if (currentWorkItem.workDescription && !currentWorkItem.hazardDescription) {
            if (lowerAi.includes('なぜ') || lowerAi.includes('理由')) {
                updateCurrentWorkItem({ hazardDescription: userText })
            }
        }

        // なぜ危険かの追加
        if (currentWorkItem.hazardDescription && !currentWorkItem.riskLevel) {
            if (lowerAi.includes('対策') || lowerAi.includes('どうすれば')) {
                const current = currentWorkItem.whyDangerous || []
                updateCurrentWorkItem({ whyDangerous: [...current, userText] })
            }
        }

        // 対策の追加
        if (currentWorkItem.whyDangerous && currentWorkItem.whyDangerous.length > 0) {
            if (lowerAi.includes('危険度') || lowerAi.includes('他に')) {
                const current = currentWorkItem.countermeasures || []
                if (!current.includes(userText)) {
                    updateCurrentWorkItem({ countermeasures: [...current, userText] })
                }
            }
        }

        // 危険度が設定されて作業が完成したらコミット
        if (currentWorkItem.riskLevel &&
            currentWorkItem.workDescription &&
            currentWorkItem.hazardDescription &&
            currentWorkItem.whyDangerous && currentWorkItem.whyDangerous.length > 0 &&
            currentWorkItem.countermeasures && currentWorkItem.countermeasures.length > 0) {
            commitWorkItem()
        }

    }, [currentWorkItem, messages, updateCurrentWorkItem, commitWorkItem])

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
            // API呼び出し
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
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
                }),
            })

            if (!response.ok) {
                throw new Error('AI応答の取得に失敗しました')
            }

            const data = await response.json() as { reply: string }

            // AI応答を追加
            addMessage('assistant', data.reply)

            // 会話から情報を抽出（簡易版：ローカルで行う）
            await extractAndUpdateData(text, data.reply)

        } catch (e) {
            console.error('Chat error:', e)
            setError(e instanceof Error ? e.message : '通信エラーが発生しました')
            // エラー時もAIメッセージを追加（再試行を促す）
            addMessage('assistant', '申し訳ありません、応答に失敗しました。もう一度お試しください。')
        } finally {
            setLoading(false)
        }
    }, [session, messages, addMessage, setLoading, setError, extractAndUpdateData])



    return {
        initializeChat,
        sendMessage,
    }
}
