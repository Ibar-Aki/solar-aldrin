# Zustand Store パターン (Slice Pattern & Persistence)

`apps/v2-modern` では、Zustand を用いてアプリケーションの状態管理を行っています。
特に、機能ごとに状態を分割する **Slice Pattern** と、データを永続化する **Persist Middleware** を組み合わせて使用しています。

## 1. Slice Pattern の採用

大規模なストアを単一のファイルで管理すると肥大化してメンテナンスが困難になるため、機能単位（KYセッション情報、チャット履歴、作業項目など）で Slice として分割しています。

### 実装例: `stores/kyStore.ts`

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createSessionSlice, type SessionSlice } from './slices/sessionSlice'
import { createWorkItemSlice, type WorkItemSlice } from './slices/workItemSlice'
import { createChatSlice, type ChatSlice } from './slices/chatSlice'

// 全てのSliceを統合した型定義
export type KYStore = SessionSlice & WorkItemSlice & ChatSlice

export const useKYStore = create<KYStore>()(
    persist( // 永続化ミドルウェア
        (...a) => ({
            ...createSessionSlice(...a),   // セッション管理
            ...createWorkItemSlice(...a), // 作業項目管理
            ...createChatSlice(...a),     // チャット履歴管理
        }),
        {
            name: 'voice-ky-v2-session-storage',
            // 必要なStateのみを永続化（関数などは除外）
            partialize: (state) => ({
                session: state.session,
                messages: state.messages,
                currentWorkItem: state.currentWorkItem,
                status: state.status,
            }),
        }
    )
)
```

## 2. Slice の作成方法

各 Slice は、状態（State）と更新アクション（Action）を持ちます。

```typescript
// slices/sessionSlice.ts (例)
import { StateCreator } from 'zustand'
import { KYStore } from '../kyStore' // 循環参照に注意が必要だが、型定義のみならOK

export interface SessionSlice {
    session: SoloKYSession | null
    startSession: (user: string, site: string) => void
    updateWeather: (weather: string) => void
}

export const createSessionSlice: StateCreator<KYStore, [], [], SessionSlice> = (set) => ({
    session: null,
    startSession: (user, site) => set({ 
        session: { id: uuidv4(), userName: user, siteName: site, ... } 
    }),
    updateWeather: (weather) => set((state) => ({
        session: state.session ? { ...state.session, weather } : null
    })),
})
```

## 3. ベストプラクティス

* **Selectorの使用**: コンポーネントでストアを使用する際は、必要なプロパティだけを取り出すことで、不要な再レンダリングを防ぎます。

    ```typescript
    // Good: 必要なデータのみ取得
    const userName = useKYStore((state) => state.session?.userName)
    
    // Bad: ストア全体を取得（変更があるたびに再レンダリング）
    const { session } = useKYStore()
    ```

* **Actionの分離**: 状態更新ロジックはコンポーネント内ではなく、ストア（Slice）のこAction内に記述し、UIとロジックを分離します。
* **PersistのPartialize**: `persist` を使う際は、`partialize` オプションで永続化するキーを明示的に指定します。これにより、一時的なUI状態などが誤って保存されるのを防げます。
