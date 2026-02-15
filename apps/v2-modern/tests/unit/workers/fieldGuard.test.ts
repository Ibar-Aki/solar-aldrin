import { describe, expect, it } from 'vitest'
import { applyKyFieldGuard } from '../../../workers/lib/chat/fieldGuard'

describe('applyKyFieldGuard', () => {
    it('原因欄に作業文が混入している場合は除外し ask_why に戻す', () => {
        const result = applyKyFieldGuard({
            workDescription: '脚立上で天井配線を固定する時',
            whyDangerous: ['脚立上で天井配線を固定する時'],
            nextAction: 'ask_risk_level',
        })

        expect(result.extracted?.whyDangerous).toBeUndefined()
        expect(result.extracted?.nextAction).toBe('ask_why')
        expect(result.askWhyEnforced).toBe(true)
    })

    it('妥当な原因文は保持する', () => {
        const result = applyKyFieldGuard({
            workDescription: '脚立上で天井配線を固定する時',
            whyDangerous: ['脚立の設置角度が不適切で足元が滑りやすいため'],
            nextAction: 'ask_risk_level',
        })

        expect(result.extracted?.whyDangerous).toEqual([
            '脚立の設置角度が不適切で足元が滑りやすいため',
        ])
        expect(result.extracted?.nextAction).toBe('ask_risk_level')
        expect(result.askWhyEnforced).toBe(false)
    })

    it('危険内容確認中の nextAction は尊重する', () => {
        const result = applyKyFieldGuard({
            workDescription: '脚立上で天井配線を固定する時',
            whyDangerous: ['脚立上で天井配線を固定する時'],
            nextAction: 'ask_hazard',
        })

        expect(result.extracted?.whyDangerous).toBeUndefined()
        expect(result.extracted?.nextAction).toBe('ask_hazard')
        expect(result.askWhyEnforced).toBe(false)
    })

    it('nextAction が未設定でも混入除去後は ask_why に戻す', () => {
        const result = applyKyFieldGuard({
            workDescription: '脚立上で天井配線を固定する時',
            whyDangerous: ['脚立上で天井配線を固定する時'],
        })

        expect(result.extracted?.whyDangerous).toBeUndefined()
        expect(result.extracted?.nextAction).toBe('ask_why')
        expect(result.askWhyEnforced).toBe(true)
    })

    it('作業中を含む妥当な原因文は誤って除外しない', () => {
        const result = applyKyFieldGuard({
            workDescription: '脚立上で天井配線を固定する時',
            whyDangerous: ['作業中に後方確認を怠るため接触事故が起こる'],
            nextAction: 'ask_risk_level',
        })

        expect(result.extracted?.whyDangerous).toEqual([
            '作業中に後方確認を怠るため接触事故が起こる',
        ])
        expect(result.extracted?.nextAction).toBe('ask_risk_level')
        expect(result.askWhyEnforced).toBe(false)
    })
})
