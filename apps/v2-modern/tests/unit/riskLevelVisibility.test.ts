import { describe, expect, it } from 'vitest'
import { shouldShowRiskLevelSelector } from '@/lib/riskLevelVisibility'

describe('shouldShowRiskLevelSelector', () => {
    it('ask_risk_level かつ未選択のとき表示する', () => {
        expect(shouldShowRiskLevelSelector({
            lastAssistantNextAction: 'ask_risk_level',
            currentRiskLevel: null,
        })).toBe(true)
    })

    it('ask_why のとき表示しない', () => {
        expect(shouldShowRiskLevelSelector({
            lastAssistantNextAction: 'ask_why',
            currentRiskLevel: null,
        })).toBe(false)
    })

    it('ask_risk_level でも選択済みなら表示しない', () => {
        expect(shouldShowRiskLevelSelector({
            lastAssistantNextAction: 'ask_risk_level',
            currentRiskLevel: 3,
        })).toBe(false)
    })

    it('nextAction が未取得なら表示しない', () => {
        expect(shouldShowRiskLevelSelector({
            currentRiskLevel: null,
        })).toBe(false)
    })
})
