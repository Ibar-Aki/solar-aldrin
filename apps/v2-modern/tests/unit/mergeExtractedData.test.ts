import { describe, expect, it } from 'vitest'
import { mergeExtractedData } from '@/lib/chat/mergeExtractedData'

describe('mergeExtractedData', () => {
    it('whyDangerous が欠落していても推論補完しない', () => {
        const currentWorkItem = {
            workDescription: '配管の溶接作業',
            hazardDescription: '火花が飛散して可燃物に引火する恐れ',
            riskLevel: 5 as const,
            countermeasures: [
                { category: 'equipment' as const, text: '消火器を作業地点の近くに配置する' },
                { category: 'behavior' as const, text: '火気監視員を1名配置する' },
            ],
        }

        const result = mergeExtractedData(currentWorkItem, {
            hazardDescription: '周囲の養生が不十分で火花が飛散して引火する恐れがあります',
            nextAction: 'ask_more_work',
        })

        expect(result.workItemPatch.whyDangerous).toBeUndefined()
        expect(result.shouldCommitWorkItem).toBe(false)
    })

    it('既存の whyDangerous がある場合は推論補完を追加しない', () => {
        const currentWorkItem = {
            workDescription: '配管の溶接作業',
            hazardDescription: '火花が飛散して可燃物に引火する恐れ',
            riskLevel: 5 as const,
            whyDangerous: ['周囲の養生が不十分なため'],
            countermeasures: [
                { category: 'equipment' as const, text: '消火器を作業地点の近くに配置する' },
                { category: 'behavior' as const, text: '火気監視員を1名配置する' },
            ],
        }

        const result = mergeExtractedData(currentWorkItem, {
            hazardDescription: '火花が飛散して可燃物に引火する恐れ',
            nextAction: 'ask_more_work',
        })

        expect(result.workItemPatch.whyDangerous).toBeUndefined()
        expect(result.shouldCommitWorkItem).toBe(false)
    })
})
