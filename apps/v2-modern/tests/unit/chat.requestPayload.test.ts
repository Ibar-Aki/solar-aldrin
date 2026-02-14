import { describe, expect, it } from 'vitest'
import { buildRequestMessages, MAX_CLIENT_HISTORY_MESSAGES } from '@/hooks/chat/requestPayload'

describe('buildRequestMessages', () => {
    it('user/assistant 以外の role を除外する', () => {
        const messages = [
            { role: 'assistant', content: '確認します' },
            { role: 'system', content: 'internal message' },
            { role: 'tool', content: 'tool output' },
            { role: 'user', content: '危険を確認します' },
        ] as Array<{ role: unknown; content: string }>

        const payload = buildRequestMessages({
            messages,
            text: '追加の入力',
            skipUserMessage: false,
            retryAssistantMessage: 'retry',
        })

        expect(payload).toEqual([
            { role: 'assistant', content: '確認します' },
            { role: 'user', content: '危険を確認します' },
            { role: 'user', content: '追加の入力' },
        ])
    })

    it('リトライ時は末尾のエラーメッセージを除外し、ユーザー入力の重複を避ける', () => {
        const payload = buildRequestMessages({
            messages: [
                { role: 'user', content: '足場点検を行います' },
                { role: 'assistant', content: '申し訳ありません、応答に失敗しました。もう一度お試しください。' },
            ],
            text: '足場点検を行います',
            skipUserMessage: true,
            retryAssistantMessage: '申し訳ありません、応答に失敗しました。もう一度お試しください。',
        })

        expect(payload).toEqual([
            { role: 'user', content: '足場点検を行います' },
        ])
    })

    it('履歴は MAX_CLIENT_HISTORY_MESSAGES に制限する', () => {
        const seed = Array.from({ length: MAX_CLIENT_HISTORY_MESSAGES + 5 }, (_, index) => ({
            role: index % 2 === 0 ? 'user' : 'assistant',
            content: `m-${index}`,
        })) as Array<{ role: unknown; content: string }>

        const payload = buildRequestMessages({
            messages: seed,
            text: 'latest',
            skipUserMessage: false,
            retryAssistantMessage: 'retry',
        })

        expect(payload).toHaveLength(MAX_CLIENT_HISTORY_MESSAGES)
        expect(payload.at(-1)).toEqual({ role: 'user', content: 'latest' })
    })
})
