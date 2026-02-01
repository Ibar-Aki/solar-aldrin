# Playwright E2E テスト戦略

`apps/v2-modern` では、**Playwright** を使用して、ユーザー操作のシミュレーション（E2Eテスト）を行っています。
特に、バックエンド（AI API）をモック化することで、安定かつ高速なテストを実現しています。

## 1. API モックの活用 (`page.route`)

実際のOpenAI APIを毎回叩くとコストがかかり、実行時間も不安定になります。
`page.route` を使って、特定のAPIリクエストに対して固定のレスポンスを返すようにします。

### 実装例: `tests/e2e/basic-flow.spec.ts`

```typescript
import { test, expect } from '@playwright/test'
import { basicFlowResponses } from './mocks/ai-responses'

test('Happy path: start session', async ({ page }) => {
    let callCount = 0

    // APiへのリクエストをインターセプト
    await page.route('**/api/chat', async (route) => {
        // 呼び出し回数に応じて異なるレスポンスを返す
        const response = basicFlowResponses[Math.min(callCount, basicFlowResponses.length - 1)]
        callCount += 1
        
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(response),
        })
    })

    // テスト手順の実行
    await page.goto('/')
    // ...
})
```

## 2. `waitForResponse` による同期

非同期処理（API呼び出しなど）の結果を待ってからアサーションを行うために、`page.waitForResponse` を活用します。これは `page.waitForTimeout(1000)` のような固定スリープよりも遥かに信頼性が高いです。

```typescript
// Good: 特定のAPIレスポンスが返ってくるのを待つ
const responsePromise = page.waitForResponse('**/api/chat')
await page.getByRole('button', { name: '送信' }).click()
await responsePromise // ここで待機完了

// UIの変化を確認
await expect(page.getByText('危険度を選択')).toBeVisible()
```

## 3. iPhone 実機テスト (`scripts/start_iphone_test.ps1`)

PCブラウザだけでなく、実際の現場に近い環境（iPhone Safari）での動作確認もサポートしています。

### コマンド

```bash
npm run test:iphone
```

または、`scripts/start_iphone_test.ps1` を実行してLAN内でサーバーを立ち上げ、実機からアクセスします。これは `playwright codegen` を応用したものではなく、Viteのホスト機能を使った実機デバッグです。

## ベストプラクティス

1. **User-Visible Locators**: `getByRole`, `getByText`, `getByPlaceholder` など、ユーザーに見える要素を使って要素を取得する（CSSセレクタやXPathは壊れやすいため避ける）。
2. **Authentication State**: ログインが必要なアプリの場合、`global-setup.ts` でログイン状態を保存し、テスト間で再利用することで高速化する（現状のKYアプリはログイン不要だが将来的考慮）。
3. **Trace Viewer**: テストが失敗した場合、Playwright Report の Trace Viewer を見ることで、DOMのスナップショットやネットワークログを時系列で確認できる。
