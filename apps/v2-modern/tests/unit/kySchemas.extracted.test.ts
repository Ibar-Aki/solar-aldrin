import { describe, it, expect } from 'vitest'
import { ExtractedDataSchema } from '../../src/lib/kySchemas'

describe('ExtractedDataSchema (coercion/normalization)', () => {
    it('should coerce legacy shapes (string arrays, string riskLevel, string whyDangerous)', () => {
        const result = ExtractedDataSchema.safeParse({
            workDescription: '配管の溶接作業',
            hazardDescription: '火花による引火',
            riskLevel: '5',
            whyDangerous: '養生不足',
            countermeasures: [
                '消火器を作業地点の近くに設置',
                { text: '手袋を着用', category: 'ppe' },
                { text: 'スパッタシートで養生' }, // category omitted
            ],
            nextAction: ' ask_goal ',
        })

        expect(result.success).toBe(true)
        if (!result.success) return

        expect(result.data.riskLevel).toBe(5)
        expect(result.data.whyDangerous).toEqual(['養生不足'])
        expect(result.data.countermeasures?.length).toBeGreaterThanOrEqual(2)
        expect(result.data.countermeasures?.every((cm) => typeof cm.text === 'string' && cm.text.length > 0)).toBe(true)
        expect(result.data.countermeasures?.every((cm) => cm.category === 'ppe' || cm.category === 'behavior' || cm.category === 'equipment')).toBe(true)
        expect(result.data.nextAction).toBe('ask_goal')
    })
})

