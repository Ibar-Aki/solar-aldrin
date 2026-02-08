# Zod スキーマバリデーション & 型定義

`apps/v2-modern` では、バリデーションライブラリ **Zod** を全面的に採用しています。
APIの入力チェックだけでなく、TypeScriptの型定義の正本（Single Source of Truth）としても活用しています。

## 1. スキーマ定義と型推論

TypeScriptの型を個別に書くのではなく、Zodスキーマから `z.infer` で型を生成します。これにより、ランタイムチェックと静的型チェックの不整合を防げます。

### 実装例: `lib/kySchemas.ts`

```typescript
import { z } from 'zod'

// 1. Enum定義
export const ProcessPhaseSchema = z.enum([
    '搬入・荷受け',
    '基礎土台・建地準備',
    '組み立て',
    // ...
])

// 2. 型の抽出
export type ProcessPhaseFromZod = z.infer<typeof ProcessPhaseSchema>

// 3. 複雑なオブジェクト定義
export const SoloKYSessionSchema = z.object({
    id: z.string().uuid(),
    userName: z.string().min(1, '名前は必須です'),
    riskLevel: z.number().min(1).max(5), // 1〜5の数値
    workStartTime: z.string().regex(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?([+-]\d{2}:\d{2}|Z)$/,
        'ISO 8601形式である必要があります'
    ),
    // ネストしたスキーマの使用
    processPhase: ProcessPhaseSchema.nullable(),
})
```

## 2. Hono API でのバリデーション (`zod-validator`)

バックエンド（Cloudflare Workers + Hono）では、`@hono/zod-validator` を使用してリクエストボディやクエリパラメータを検証します。

```typescript
import { zValidator } from '@hono/zod-validator'

app.post('/api/ky/start', 
    zValidator('json', z.object({
        userName: z.string().min(1),
        siteName: z.string().min(1)
    })),
    (c) => {
        // ここではバリデーション済みのデータが型安全に扱える
        const { userName, siteName } = c.req.valid('json')
        return c.json({ message: `Session started for ${userName}` })
    }
)
```

## 3. 構造化データのバリデーション（AI連携）

OpenAIなどから返ってくるJSONデータ（Structured Outputs）の検証にもZodは非常に有効です。

```typescript
export const ExtractedDataSchema = z.object({
    workDescription: z.string().nullable(),
    riskLevel: z.number().min(1).max(5).nullable(),
    nextAction: z.enum(['ask_work', 'confirm', 'completed']).optional(),
})

// AIのレスポンスをパースして検証
const result = ExtractedDataSchema.safeParse(aiResponseJson)
if (result.success) {
    // 正常なデータ
    const data = result.data
} else {
    // エラーハンドリング
    console.error(result.error)
}
```

## ポイント

* **Single Source of Truth**: 型定義ファイル（`.d.ts`）を個別に作るのではなく、可能な限り `zod` スキーマから型を生成する。
* **`safeParse` の活用**: 外部データ（APIレスポンスやユーザー入力）には必ずバリデーションを行い、アプリケーション内部の整合性を保つ。
* **詳細なバリデーション**: 単なる `string` ではなく、`.min(1)`, `.uuid()`, `.regex()` などを使って厳密に定義する。
