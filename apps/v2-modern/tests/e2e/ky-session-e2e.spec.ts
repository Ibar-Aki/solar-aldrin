/**
 * KYセッション E2Eテスト (Consolidated)
 *
 * テスト名: ky-session-e2e
 *
 * 以下のフローを検証します:
 * 1. ホーム画面 -> セッション開始 (Happy Path)
 * 2. 高所作業シナリオ (Edge Case)
 * 3. 最小入力シナリオ (Validation)
 *
 * 統合された `basic-flow.spec.ts` のアサーションを含みます。
 */

import { test, expect, type Page } from '@playwright/test'
import { basicFlowResponses } from './mocks/ai-responses'

test.describe('KYセッション統合E2E', () => {
    test.beforeEach(async ({ page }) => {
        // デフォルトは汎用モック（必要に応じて各テストでoverride）
        await page.route('**/api/chat', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    reply: '詳細を教えてください。',
                    extracted: {},
                }),
            })
        })
        await page.goto('/')
    })

    test('標準フロー: 開始からPDF完了まで (Happy Path)', async ({ page }) => {
        // モックのオーバーライド（状態遷移を伴うレスポンス）
        let callCount = 0
        await page.route('**/api/chat', async (route) => {
            const response = basicFlowResponses[Math.min(callCount, basicFlowResponses.length - 1)]
            callCount += 1
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(response),
            })
        })

        // 1. ホーム画面入力
        await page.getByPlaceholder('例：田中太郎').fill('テスト太郎')
        await page.getByPlaceholder('例：〇〇ビル改修工事').fill('E2E現場')
        await page.getByRole('button', { name: 'KY活動を開始' }).click()
        await page.waitForURL('**/session')

        // 2. 対話フロー
        const firstResponse = page.waitForResponse('**/api/chat')
        await sendUserMessage(page, '高所作業を行います')
        await firstResponse

        // 危険度選択（モックによりnextAction: ask_risk_levelになっているはず）
        const riskSelector = page.getByText('危険度を選択').locator('..')
        await expect(riskSelector).toBeVisible({ timeout: 10000 })

        const secondResponse = page.waitForResponse('**/api/chat')
        await riskSelector.getByRole('button', { name: '3' }).click()
        await secondResponse

        // 3. 完了フロー
        const finishButton = page.getByRole('button', { name: '行動目標を決めて終了する' })
        await expect(finishButton).toBeVisible()
        await finishButton.click()

        await page.waitForURL('**/complete')

        // 4. PDF生成確認
        const pdfButton = page.getByRole('button', { name: 'PDF記録をダウンロード' })
        await expect(pdfButton).toBeVisible()

        console.log('✅ 標準フロー完了')
    })

    test('高所作業フロー（コンテキスト入力確認）', async ({ page }) => {
        // ホーム画面
        await page.getByPlaceholder('例：田中太郎').fill('山田')
        await page.getByPlaceholder('例：〇〇ビル改修工事').fill('倉庫新築')

        // 天候選択（強風）
        const weatherSelect = page.locator('label', { hasText: '天候' }).locator('..').locator('select')
        await weatherSelect.selectOption('強風')

        await page.getByRole('button', { name: 'KY活動を開始' }).click()
        await page.waitForTimeout(1000)

        // 入力の堅牢性チェック（エラーが出ないこと）
        await sendUserMessage(page, 'クレーン作業')
        await waitForAIResponse(page)

        await sendUserMessage(page, '吊り荷落下')
        await waitForAIResponse(page)

        // URLが維持されていること（クラッシュしていない）
        await expect(page).toHaveURL(/\/session/)
        console.log('✅ 高所作業フロー完了')
    })

    test('最小入力・エッジケース', async ({ page }) => {
        await page.getByPlaceholder('例：田中太郎').fill('A')
        await page.getByPlaceholder('例：〇〇ビル改修工事').fill('B')
        await page.getByRole('button', { name: 'KY活動を開始' }).click()

        // 極端に短い入力
        await sendUserMessage(page, 'あ')
        await waitForAIResponse(page)

        await expect(page).toHaveURL(/\/session/)
        console.log('✅ 最小入力テスト完了')
    })
})

// Helpers
async function sendUserMessage(page: Page, message: string) {
    const input = page.getByPlaceholder('メッセージを入力...')
    await input.fill(message)
    await input.press('Enter')
}

async function waitForAIResponse(page: Page) {
    // ローディング表示（考え中...）が表示されるのを待つ（即座に出るはずだが少し待つ）
    // Note: 高速すぎて表示されない場合もあるので、catchで無視せず、次のメッセージ出現を待つロジックとも組み合わせるのが理想
    // ここでは「考え中...」が消えることを確実に待つ戦略をとる

    try {
        await page.waitForSelector('text=考え中...', { state: 'visible', timeout: 2000 })
        await page.waitForSelector('text=考え中...', { state: 'hidden', timeout: 30000 })
    } catch {
        // ローディングが一瞬で終わった、または表示されなかった場合は無視して
        // メッセージが増えていることを確認する等の追加チェックが望ましいが、
        // 現状はエラーにしない
    }

    // AIの返信枠が表示されていることを確認（クラス名やroleで特定できればより良い）
    // ここでは簡易的に少し待つのではなく、入力欄が再有効化されるのを待つ
    const input = page.getByPlaceholder('メッセージを入力...')
    await expect(input).toBeEnabled()
}
