import type { StateCreator } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { WorkItem } from '@/types/ky'
import type { KYStore } from '../kyStore'
import { isWorkItemComplete } from '@/lib/validation'
import { isNonAnswerText } from '@/lib/nonAnswer'

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
        const { session, currentWorkItem, messages, addMessage } = get()
        if (!session) return

        // 仕様: 危険は最大2件まで（3件目以降は保存しない）
        if (session.workItems.length >= 2) {
            set({
                error: '危険の登録は2件までです',
                errorSource: 'validation',
            })
            return
        }

        // 必須フィールド + 対策2件以上のチェック
        if (!isWorkItemComplete(currentWorkItem)) {
            set({
                error: '作業項目が不完全です（対策は2件以上が必要です）',
                errorSource: 'validation',
            })
            return
        }

        const completeItem: WorkItem = {
            id: currentWorkItem.id || uuidv4(),
            workDescription: currentWorkItem.workDescription ?? '',
            hazardDescription: currentWorkItem.hazardDescription ?? '',
            riskLevel: currentWorkItem.riskLevel as 1 | 2 | 3 | 4 | 5,
            // 念のため、保存時にも非回答/空値を除去しておく（AI/手入力の揺れ対策）
            whyDangerous: (currentWorkItem.whyDangerous ?? [])
                .map((v) => (typeof v === 'string' ? v.trim() : ''))
                .filter((v) => v.length > 0 && !isNonAnswerText(v))
                .slice(0, 3),
            countermeasures: (currentWorkItem.countermeasures ?? [])
                .map((cm) => ({ ...cm, text: typeof cm.text === 'string' ? cm.text.trim() : '' }))
                .filter((cm) => cm.text.length > 0 && !isNonAnswerText(cm.text)),
        }

        const nextWorkItems = [...session.workItems, completeItem]
        set({
            session: {
                ...session,
                workItems: nextWorkItems,
            },
            currentWorkItem: createEmptyWorkItem(),
            // AIが誤って ask_more_work を返しても、2件固定なら行動目標へ寄せる。
            ...(nextWorkItems.length >= 2 ? { status: 'action_goal' as const } : {}),
            error: null,
            errorSource: null,
        })

        // UX保険: 2件目が保存されたら、AI文言に依存せず「行動目標」入力へ誘導する。
        if (nextWorkItems.length >= 2) {
            const lastAssistantNextAction = (() => {
                for (let i = messages.length - 1; i >= 0; i -= 1) {
                    const msg = messages[i]
                    if (msg.role === 'assistant' && msg.extractedData?.nextAction) {
                        return msg.extractedData.nextAction
                    }
                }
                return undefined
            })()
            if (lastAssistantNextAction !== 'ask_goal') {
                addMessage(
                    'assistant',
                    '了解です。次に、今日の行動目標を短く1つだけ教えてください。',
                    { nextAction: 'ask_goal' }
                )
            }
        }
    },

    startNewWorkItem: () => {
        set({ currentWorkItem: createEmptyWorkItem() })
    },
})
