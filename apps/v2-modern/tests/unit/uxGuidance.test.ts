import { describe, expect, it } from 'vitest'
import { getAiWaitStatus, getHomeStartReadiness } from '@/lib/uxGuidance'

describe('uxGuidance', () => {
    it('ホーム開始条件の不足項目を具体的に返す', () => {
        expect(getHomeStartReadiness({ userName: '', siteName: '' })).toMatchObject({
            canStart: false,
            reason: 'missing_both',
            message: '作業者名と現場名を入力すると開始できます。',
        })
        expect(getHomeStartReadiness({ userName: '田中', siteName: '' })).toMatchObject({
            canStart: false,
            reason: 'missing_site',
            message: '現場名を入力すると開始できます。',
        })
        expect(getHomeStartReadiness({ userName: '', siteName: 'A現場' })).toMatchObject({
            canStart: false,
            reason: 'missing_user',
            message: '作業者名を入力すると開始できます。',
        })
        expect(getHomeStartReadiness({ userName: '田中', siteName: 'A現場' })).toMatchObject({
            canStart: true,
            reason: 'ready',
        })
    })

    it('AI待機状態を経過時間で段階化する', () => {
        expect(getAiWaitStatus(0, 15_000)).toMatchObject({
            stage: 'sending',
            label: '送信中...',
        })
        expect(getAiWaitStatus(3_000, 15_000)).toMatchObject({
            stage: 'thinking',
            label: 'AIが内容を確認中...',
        })
        expect(getAiWaitStatus(16_000, 15_000)).toMatchObject({
            stage: 'slow',
            label: '応答が遅れています',
        })
    })
})
