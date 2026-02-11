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

    it.each([
        ['ky 完了'],
        ['KY完了。'],
        ['ＫＹ完了'],
        ['ｋｙ完了'],
        ['  ｋｙ　完了！  '],
    ])('KY完了の表記ゆれでも、API無しで行動目標フェーズへスキップできる (%s)', async (input) => {
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
            await result.current.sendMessage(input)
        })

        expect(vi.mocked(postChat)).not.toHaveBeenCalled()
        expect(useKYStore.getState().status).toBe('action_goal')

        const msgs = useKYStore.getState().messages
        expect(msgs.at(-2)?.role).toBe('user')
        expect(msgs.at(-2)?.content).toBe(input.trim())
        expect(msgs.at(-1)?.role).toBe('assistant')
        expect(msgs.at(-1)?.extractedData?.nextAction).toBe('ask_goal')
    })

    it('危険2件が保存済みなら、KY完了でAPI無しのままセッション完了に進める', async () => {
        const { updateCurrentWorkItem, commitWorkItem } = useKYStore.getState()

        const commitCompleteWorkItem = (index: number) => {
            updateCurrentWorkItem({
                workDescription: `作業${index}`,
                hazardDescription: `危険${index}`,
                riskLevel: 3,
                whyDangerous: [`要因${index}`],
                countermeasures: [
                    { category: 'equipment', text: `設備対策${index}` },
                    { category: 'ppe', text: `保護具対策${index}` },
                ],
            })
            commitWorkItem()
        }

        commitCompleteWorkItem(1)
        commitCompleteWorkItem(2)

        expect(useKYStore.getState().session?.workItems).toHaveLength(2)
        expect(useKYStore.getState().status).toBe('action_goal')

        const { result } = renderHook(() => useChat())
        await act(async () => {
            await result.current.sendMessage('KY完了')
        })

        const state = useKYStore.getState()
        expect(vi.mocked(postChat)).not.toHaveBeenCalled()
        expect(state.status).toBe('completed')
        expect(state.session?.completedAt).not.toBeNull()

        const msgs = state.messages
        expect(msgs.at(-2)?.role).toBe('user')
        expect(msgs.at(-2)?.content).toBe('KY完了')
        expect(msgs.at(-1)?.role).toBe('assistant')
        expect(msgs.at(-1)?.extractedData?.nextAction).toBe('completed')
    })

    it('行動目標入力フェーズでは、明確な目標入力をローカル確定してAPI呼び出しを抑止する', async () => {
        useKYStore.getState().setStatus('action_goal')

        const { result } = renderHook(() => useChat())

        await act(async () => {
            await result.current.sendMessage('行動目標は「火気使用時の完全養生よし！」です。これで確定して終了します。')
        })

        const state = useKYStore.getState()
        expect(vi.mocked(postChat)).not.toHaveBeenCalled()
        expect(state.session?.actionGoal).toBe('火気使用時の完全養生よし！')
        expect(state.status).toBe('confirmation')
        expect(state.messages.at(-1)?.extractedData?.nextAction).toBe('confirm')
    })

    it('行動目標が既にある場合は、完了意思のみの発話でもAPI無しで確認フェーズへ進める', async () => {
        useKYStore.getState().updateActionGoal('火気使用時の完全養生よし！')
        useKYStore.getState().setStatus('action_goal')

        const { result } = renderHook(() => useChat())

        await act(async () => {
            await result.current.sendMessage('これで完了します。')
        })

        const state = useKYStore.getState()
        expect(vi.mocked(postChat)).not.toHaveBeenCalled()
        expect(state.session?.actionGoal).toBe('火気使用時の完全養生よし！')
        expect(state.status).toBe('confirmation')
        expect(state.messages.at(-1)?.extractedData?.nextAction).toBe('confirm')
    })
})
