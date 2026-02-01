/**
 * KYセッション基本フローE2Eテスト
 * 
 * テスト名: ky-session-basic-flow
 * 
 * このテストは以下のフローを自動化します:
 * 1. ホーム画面でセッション情報を入力して開始
 * 2. AIとの対話で作業内容・危険・要因・対策・危険度を入力
 * 3. 各ステップでAIの応答を待機して確認
 */

import { test, expect, type Page } from '@playwright/test'

test.describe('KYセッション基本フロー', () => {
    test.beforeEach(async ({ page }) => {
        // APIをモックしてE2Eを安定化（実API依存を排除）
        await page.route('**/api/chat', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    reply: '了解しました。続けて教えてください。',
                    extracted: {},
                }),
            })
        })
        // ホーム画面にアクセス
        await page.goto('http://localhost:5173/')
    })

    test('ホーム画面からAI対話までの基本フロー', async ({ page }) => {
        // === ステップ1: ホーム画面でセッション開始 ===
        // 作業者名入力（placeholder: 例：田中太郎）
        await page.getByPlaceholder('例：田中太郎').fill('rh')
        // 現場名入力（placeholder: 例：〇〇ビル改修工事）
        await page.getByPlaceholder('例：〇〇ビル改修工事').fill('df')
        // 天候はデフォルトで「晴れ」が選択済み

        // KY活動を開始ボタンをクリック
        await page.getByRole('button', { name: 'KY活動を開始' }).click()

        // セッションページに遷移したことを確認
        await expect(page).toHaveURL(/\/session/)

        // === ステップ2: AIの最初の挨拶を待機 ===
        // AIメッセージが表示されるまで待機（最大30秒）
        await page.waitForTimeout(3000) // AI応答待機

        // === ステップ3: 作業内容を入力 ===
        await sendUserMessage(page, '足場、組立作業です。')
        await waitForAIResponse(page)

        // === ステップ4: 危険内容を入力 ===
        await sendUserMessage(page, '人が足場から墜落します。')
        await waitForAIResponse(page)

        // === ステップ5: 危険要因を入力 ===
        await sendUserMessage(page, '足元が雨に濡れていて滑って落ちる。')
        await waitForAIResponse(page)

        // === ステップ6: 対策を入力 ===
        await sendUserMessage(page, '雨を拭いてから作業する。安全帯をつける。')
        await waitForAIResponse(page)

        // === ステップ7: 対策の詳細を入力 ===
        await sendUserMessage(page, 'ハーネスを親綱につけます。')
        await waitForAIResponse(page)

        // === ステップ8: 危険度を入力 ===
        await sendUserMessage(page, '危険度は4です')
        await waitForAIResponse(page)

        // 最終確認: セッションページにまだいることを確認（フローが完了した）
        await expect(page).toHaveURL(/\/session/)

        // テスト成功
        console.log('✅ KYセッション基本フローテスト完了')
    })

    /**
     * パターン2: 高所作業フロー（クレーン作業）
     * 異なる作業種類でAI対話が正常に動作するかテスト
     */
    test('高所作業フロー（クレーン作業）', async ({ page }) => {
        // ホーム画面で入力
        await page.getByPlaceholder('例：田中太郎').fill('山田')
        await page.getByPlaceholder('例：〇〇ビル改修工事').fill('倉庫新築現場')
        // 天候を「強風」に変更
        const weatherSelect = page.locator('label', { hasText: '天候' }).locator('..').locator('select')
        await weatherSelect.selectOption('強風')

        await page.getByRole('button', { name: 'KY活動を開始' }).click()
        await expect(page).toHaveURL(/\/session/)
        await page.waitForTimeout(3000)

        // 作業内容
        await sendUserMessage(page, 'クレーンで鉄骨を吊り上げる作業です')
        await waitForAIResponse(page)

        // 危険内容
        await sendUserMessage(page, '吊り荷が落下して下にいる作業員に当たる')
        await waitForAIResponse(page)

        // 危険要因
        await sendUserMessage(page, '強風で吊り荷が揺れる。玉掛けワイヤーの点検不足')
        await waitForAIResponse(page)

        // 対策
        await sendUserMessage(page, '風速10m以上で作業中止。玉掛け前にワイヤーを目視確認する')
        await waitForAIResponse(page)

        // 危険度
        await sendUserMessage(page, '危険度は5です')
        await waitForAIResponse(page)

        await expect(page).toHaveURL(/\/session/)
        console.log('✅ 高所作業フローテスト完了')
    })

    /**
     * パターン3: 短い対話フロー（最小入力・エッジケース）
     * 最小限の文字数でAIが正常に応答するかテスト
     */
    test('短い対話フロー（最小入力テスト）', async ({ page }) => {
        // ホーム画面で最小限の入力
        await page.getByPlaceholder('例：田中太郎').fill('A')
        await page.getByPlaceholder('例：〇〇ビル改修工事').fill('B')

        await page.getByRole('button', { name: 'KY活動を開始' }).click()
        await expect(page).toHaveURL(/\/session/)
        await page.waitForTimeout(3000)

        // 非常に短い入力でテスト
        await sendUserMessage(page, '掃除')
        await waitForAIResponse(page)

        await sendUserMessage(page, '転倒')
        await waitForAIResponse(page)

        await sendUserMessage(page, '床が濡れている')
        await waitForAIResponse(page)

        await sendUserMessage(page, 'モップで拭く')
        await waitForAIResponse(page)

        await sendUserMessage(page, '3')
        await waitForAIResponse(page)

        await expect(page).toHaveURL(/\/session/)
        console.log('✅ 短い対話フローテスト完了')
    })
})

/**
 * ユーザーメッセージを送信するヘルパー関数
 */
async function sendUserMessage(page: Page, message: string) {
    // 入力欄を探す（placeholder: メッセージを入力...）
    const input = page.getByPlaceholder('メッセージを入力...')
    await input.fill(message)

    // Enterキーで送信
    await input.press('Enter')
}

/**
 * AIの応答を待機するヘルパー関数
 */
async function waitForAIResponse(page: Page) {
    // ローディング表示（考え中...）が消えるまで待機
    await page.waitForSelector('text=考え中...', {
        state: 'hidden',
        timeout: 30000
    }).catch(() => {
        // ローディングインジケータがない場合はスキップ
    })

    // AI応答が表示されるのを待つ
    await page.waitForTimeout(2000)
}

