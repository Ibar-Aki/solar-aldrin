import { describe, it, expect, beforeEach } from 'vitest'
import { useKYStore } from '@/stores/kyStore'

// テストごとにストアをリセット
const initialState = useKYStore.getState()
beforeEach(() => {
    useKYStore.setState(initialState, true)
})

describe('kyStore', () => {
    it('starts a new session correctly', () => {
        const { startSession } = useKYStore.getState()
        startSession('Test User', 'Test Site', 'Sunny', 25)

        const { session, status } = useKYStore.getState()
        expect(session).not.toBeNull()
        expect(session?.userName).toBe('Test User')
        expect(session?.siteName).toBe('Test Site')
        expect(session?.weather).toBe('Sunny')
        expect(session?.temperature).toBe(25)
        expect(status).toBe('work_items')
    })

    it('adds messages correctly', () => {
        const { startSession, addMessage } = useKYStore.getState()
        startSession('User', 'Site', 'Rain')

        addMessage('user', 'Hello AI')
        addMessage('assistant', 'Hello User')

        const { messages } = useKYStore.getState()
        expect(messages).toHaveLength(2)
        expect(messages[0].role).toBe('user')
        expect(messages[0].content).toBe('Hello AI')
        expect(messages[1].role).toBe('assistant')
        expect(messages[1].content).toBe('Hello User')
    })

    it('updates current work item', () => {
        const { updateCurrentWorkItem } = useKYStore.getState()

        updateCurrentWorkItem({ workDescription: 'Painting' })
        expect(useKYStore.getState().currentWorkItem.workDescription).toBe('Painting')

        updateCurrentWorkItem({ riskLevel: 3 })
        expect(useKYStore.getState().currentWorkItem.riskLevel).toBe(3)
    })

    it('commits a valid work item', () => {
        const { startSession, updateCurrentWorkItem, commitWorkItem } = useKYStore.getState()
        startSession('User', 'Site', 'Rain')

        // 不完全なアイテムはコミットできない
        commitWorkItem()
        expect(useKYStore.getState().session?.workItems).toHaveLength(0)
        expect(useKYStore.getState().error).toBe('作業項目が不完全です')

        // 完全なアイテムを作成
        updateCurrentWorkItem({
            workDescription: 'Painting',
            hazardDescription: 'Falling',
            riskLevel: 4,
            whyDangerous: ['High place'],
            countermeasures: ['Use harness'],
        })

        commitWorkItem()

        const { session, currentWorkItem, error } = useKYStore.getState()
        expect(error).toBeNull()
        expect(session?.workItems).toHaveLength(1)
        expect(session?.workItems[0].workDescription).toBe('Painting')
        // リセットされているか確認
        expect(currentWorkItem.workDescription).toBeUndefined()
    })

    it('completes the session', () => {
        const { startSession, completeSession } = useKYStore.getState()
        startSession('User', 'Site', 'Rain')

        completeSession({
            actionGoal: 'Safety First',
            pointingConfirmed: true,
            allMeasuresImplemented: true,
            hadNearMiss: false,
        })

        const { session, status } = useKYStore.getState()
        expect(status).toBe('completed')
        expect(session?.actionGoal).toBe('Safety First')
        expect(session?.completedAt).not.toBeNull()
    })
})
