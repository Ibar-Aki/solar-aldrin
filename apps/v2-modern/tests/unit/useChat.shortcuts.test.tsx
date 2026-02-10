import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useChat } from '@/hooks/useChat'
import { useKYStore } from '@/stores/kyStore'
import { postChat } from '@/lib/api'

vi.mock('@/lib/api', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/api')>()
    return {
        ...actual,
        postChat: vi.fn(),
    }
})

vi.mock('@/lib/contextUtils', () => ({
    buildContextInjection: vi.fn(async () => null),
    getWeatherContext: vi.fn(() => null),
}))

vi.mock('@/lib/observability/telemetry', () => ({
    sendTelemetry: vi.fn(async () => undefined),
}))

const initialState = useKYStore.getState()

describe('useChat shortcuts', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useKYStore.setState(initialState, true)
        window.localStorage.clear()
        useKYStore.getState().startSession('Test User', 'Test Site', '晴れ', 'フリー', 'good')
    })

    it('applyRiskLevelSelectionはAPIを呼ばず、対策フェーズへ進める', async () => {
        const { result } = renderHook(() => useChat())

        await act(async () => {
            result.current.applyRiskLevelSelection(3)
        })

        expect(vi.mocked(postChat)).not.toHaveBeenCalled()
        expect(useKYStore.getState().currentWorkItem.riskLevel).toBe(3)

        const msgs = useKYStore.getState().messages
        expect(msgs.at(-2)?.role).toBe('user')
        expect(msgs.at(-2)?.content).toContain('危険度は3です')
        expect(msgs.at(-1)?.role).toBe('assistant')
        expect(msgs.at(-1)?.extractedData?.nextAction).toBe('ask_countermeasure')
    })

    it('KY完了の表記ゆれでも、API無しで行動目標フェーズへスキップできる', async () => {
        const { updateCurrentWorkItem, commitWorkItem } = useKYStore.getState()

        // 1件目を保存済みにする
        updateCurrentWorkItem({
            workDescription: '足場作業',
            hazardDescription: '転落',
            riskLevel: 4,
            whyDangerous: ['足元が不安定'],
            countermeasures: [
                { category: 'equipment', text: '手すりを設置する' },
                { category: 'ppe', text: '安全帯を二丁掛けで使用する' },
            ],
        })
        commitWorkItem()
        expect(useKYStore.getState().session?.workItems).toHaveLength(1)
        expect(useKYStore.getState().status).toBe('work_items')

        const { result } = renderHook(() => useChat())

        await act(async () => {
            await result.current.sendMessage('ky 完了')
        })

        expect(vi.mocked(postChat)).not.toHaveBeenCalled()
        expect(useKYStore.getState().status).toBe('action_goal')

        const msgs = useKYStore.getState().messages
        expect(msgs.at(-2)?.role).toBe('user')
        expect(msgs.at(-2)?.content).toBe('ky 完了')
        expect(msgs.at(-1)?.role).toBe('assistant')
        expect(msgs.at(-1)?.extractedData?.nextAction).toBe('ask_goal')
    })
})

