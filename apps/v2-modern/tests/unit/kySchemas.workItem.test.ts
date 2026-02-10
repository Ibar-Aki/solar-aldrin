import { describe, it, expect } from 'vitest'
import { WorkItemSchema, normalizeCountermeasuresInput } from '../../src/lib/kySchemas'

describe('WorkItemSchema', () => {
    const base = {
        id: '11111111-1111-4111-8111-111111111111',
        workDescription: '足場の点検',
        hazardDescription: '転落のおそれ',
        riskLevel: 3,
        whyDangerous: ['手すりが不十分'],
    }

    it('should reject when countermeasures has only 1 item', () => {
        const result = WorkItemSchema.safeParse({
            ...base,
            countermeasures: [{ category: 'behavior', text: '声掛けをする' }],
        })
        expect(result.success).toBe(false)
    })

    it('should accept when countermeasures has 2 items', () => {
        const result = WorkItemSchema.safeParse({
            ...base,
            countermeasures: [
                { category: 'behavior', text: '声掛けをする' },
                { category: 'equipment', text: '手すりを設置する' },
            ],
        })
        expect(result.success).toBe(true)
    })

    it('should reject when whyDangerous has 4 items (max 3)', () => {
        const result = WorkItemSchema.safeParse({
            ...base,
            whyDangerous: ['a', 'b', 'c', 'd'],
            countermeasures: [
                { category: 'behavior', text: '声掛けをする' },
                { category: 'equipment', text: '手すりを設置する' },
            ],
        })
        expect(result.success).toBe(false)
    })
})

describe('normalizeCountermeasuresInput', () => {
    it('should normalize legacy string[] into behavior measures', () => {
        const normalized = normalizeCountermeasuresInput(['  手すりを設置  ', '声掛けをする'])
        expect(normalized).toEqual([
            { category: 'behavior', text: '手すりを設置' },
            { category: 'behavior', text: '声掛けをする' },
        ])
    })

    it('should dedupe case-insensitively and keep first occurrence', () => {
        const normalized = normalizeCountermeasuresInput(['Check', 'check', 'CHECK  ', 'Other'])
        expect(normalized).toEqual([
            { category: 'behavior', text: 'Check' },
            { category: 'behavior', text: 'Other' },
        ])
    })
})
