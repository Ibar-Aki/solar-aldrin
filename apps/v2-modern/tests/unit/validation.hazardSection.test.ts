import { describe, expect, it } from 'vitest'
import { isHazardSectionComplete, isWorkItemComplete } from '@/lib/validation'
import type { WorkItem } from '@/types/ky'

function createBaseItem(): Partial<WorkItem> {
    return {
        workDescription: '溶接作業をする',
        hazardDescription: '火花が飛散して火災になる',
        riskLevel: 4,
        whyDangerous: ['可燃物が近くにあるため'],
    }
}

describe('isHazardSectionComplete', () => {
    it('危険情報4項目がそろっていると true を返す', () => {
        expect(isHazardSectionComplete(createBaseItem())).toBe(true)
    })

    it('危険度が未入力だと false を返す', () => {
        const item = createBaseItem()
        item.riskLevel = undefined
        expect(isHazardSectionComplete(item)).toBe(false)
    })

    it('whyDangerous が非回答のみだと false を返す', () => {
        const item = createBaseItem()
        item.whyDangerous = ['なし']
        expect(isHazardSectionComplete(item)).toBe(false)
    })
})

describe('isWorkItemComplete', () => {
    it('危険情報4項目が揃っていても対策が2件未満なら false', () => {
        const item = createBaseItem()
        item.countermeasures = [{ category: 'equipment', text: '消火器を配置する' }]
        expect(isWorkItemComplete(item)).toBe(false)
    })
})

