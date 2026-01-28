import type { StateCreator } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { WorkItem } from '@/types/ky'
import type { KYStore } from '../kyStore'

export interface WorkItemSlice {
    currentWorkItem: Partial<WorkItem>
    updateCurrentWorkItem: (data: Partial<WorkItem>) => void
    commitWorkItem: () => void
    startNewWorkItem: () => void
}

const createEmptyWorkItem = (): Partial<WorkItem> => ({
    id: uuidv4(),
    whyDangerous: [],
    countermeasures: [],
})

export const createWorkItemSlice: StateCreator<KYStore, [], [], WorkItemSlice> = (set, get) => ({
    currentWorkItem: createEmptyWorkItem(),

    updateCurrentWorkItem: (data) => {
        set((state) => ({
            currentWorkItem: { ...state.currentWorkItem, ...data },
        }))
    },

    commitWorkItem: () => {
        const { session, currentWorkItem } = get()
        if (!session) return

        // 必須フィールドのチェック
        if (
            !currentWorkItem.workDescription ||
            !currentWorkItem.hazardDescription ||
            !currentWorkItem.riskLevel ||
            !currentWorkItem.whyDangerous?.length ||
            !currentWorkItem.countermeasures?.length
        ) {
            set({ error: '作業項目が不完全です' })
            return
        }

        const completeItem: WorkItem = {
            id: currentWorkItem.id || uuidv4(),
            workDescription: currentWorkItem.workDescription,
            hazardDescription: currentWorkItem.hazardDescription,
            riskLevel: currentWorkItem.riskLevel as 1 | 2 | 3 | 4 | 5,
            whyDangerous: currentWorkItem.whyDangerous,
            countermeasures: currentWorkItem.countermeasures,
        }

        set({
            session: {
                ...session,
                workItems: [...session.workItems, completeItem],
            },
            currentWorkItem: createEmptyWorkItem(),
            error: null,
        })
    },

    startNewWorkItem: () => {
        set({ currentWorkItem: createEmptyWorkItem() })
    },
})
