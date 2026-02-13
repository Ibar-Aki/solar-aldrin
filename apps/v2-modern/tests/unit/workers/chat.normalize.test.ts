import { describe, expect, it } from 'vitest'
import { compactExtractedData, normalizeModelResponse } from '../../../workers/lib/chat/normalize'

describe('chat normalize helpers', () => {
    it('汎用的な相づち応答は会話進行用の文面へ補正する', () => {
        const normalized = normalizeModelResponse(
            {
                reply: '承知しました。続けてください。',
            },
            [{ role: 'user', content: '危険度は5です' }]
        )

        expect(normalized.reply).toContain('対策')
    })

    it('actionGoal入力時に ask_goal を confirm に補正する', () => {
        const normalized = normalizeModelResponse(
            {
                reply: '了解しました。',
                extracted: {
                    nextAction: 'ask_goal',
                    actionGoal: null,
                },
            },
            [{ role: 'user', content: '行動目標は足元確認ヨシにします' }]
        )

        expect((normalized.extracted as { nextAction?: string; actionGoal?: string } | undefined)?.nextAction).toBe('confirm')
        expect((normalized.extracted as { actionGoal?: string } | undefined)?.actionGoal).toBe('足元確認ヨシ')
    })

    it('未確定の空値を compactExtractedData で除去する', () => {
        const compacted = compactExtractedData({
            workDescription: '',
            hazardDescription: '  ',
            whyDangerous: [],
            countermeasures: [
                { category: 'ppe', text: '  ' },
                { category: 'ppe', text: '手袋を着用する' },
            ],
            nextAction: 'ask_countermeasure',
            actionGoal: null,
        })

        expect(compacted).toEqual({
            countermeasures: [{ category: 'ppe', text: '手袋を着用する' }],
            nextAction: 'ask_countermeasure',
        })
    })
})
