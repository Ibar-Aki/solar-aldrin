import { describe, expect, it } from 'vitest'
import { isWorkItemComplete } from '@/lib/validation'

describe('validation - non-answer filtering', () => {
    it('対策の「なし」はカウントせず、完了扱いにならない', () => {
        const ok = isWorkItemComplete({
            workDescription: '塗装作業',
            hazardDescription: '転倒',
            riskLevel: 3,
            whyDangerous: ['床が滑りやすい'],
            countermeasures: [
                { category: 'equipment', text: '養生して滑り止めを敷く' },
                { category: 'equipment', text: 'なし' },
            ],
        })
        expect(ok).toBe(false)
    })

    it('要因の「特になし」はカウントせず、完了扱いにならない', () => {
        const ok = isWorkItemComplete({
            workDescription: '搬入作業',
            hazardDescription: '挟まれ',
            riskLevel: 2,
            whyDangerous: ['特になし'],
            countermeasures: [
                { category: 'behavior', text: '声掛けして合図を徹底する' },
                { category: 'equipment', text: '立入禁止区画を作る' },
            ],
        })
        expect(ok).toBe(false)
    })
})

