import { describe, it, expect } from 'vitest'
import { countConversationTurns, detectErrorLoopFromEvents } from '@/lib/observability/metricsKpi'

describe('KPI & Metrics Logic', () => {
    it('会話ターン数を user 発言ベースで算出する', () => {
        const turns = countConversationTurns([
            { role: 'assistant', content: '開始します' },
            { role: 'user', content: '足場点検をします' },
            { role: 'assistant', content: '危険を教えてください' },
            { role: 'user', content: ' ' },
            { role: 'user', content: '高所で転落のおそれ' },
        ])

        expect(turns).toBe(2)
    })

    it('chat_error / retry_failed が連続するとエラーループと判定する', () => {
        const hasLoop = detectErrorLoopFromEvents([
            { event: 'chat_error' },
            { event: 'retry_clicked' },
            { event: 'retry_failed' },
            { event: 'chat_error' },
        ])

        expect(hasLoop).toBe(true)
    })

    it('retry_succeeded で連続エラーをリセットする', () => {
        const hasLoop = detectErrorLoopFromEvents([
            { event: 'chat_error' },
            { event: 'retry_failed' },
            { event: 'retry_succeeded' },
            { event: 'chat_error' },
            { event: 'session_complete' },
        ])

        expect(hasLoop).toBe(false)
    })
})
