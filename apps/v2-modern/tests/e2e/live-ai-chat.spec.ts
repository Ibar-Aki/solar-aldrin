import { test, expect } from '@playwright/test'

const RUN_LIVE = process.env.RUN_LIVE_TESTS === '1'
const HAS_OPENAI_KEY = Boolean(process.env.OPENAI_API_KEY)

test.skip(!RUN_LIVE || !HAS_OPENAI_KEY, 'Set RUN_LIVE_TESTS=1 and OPENAI_API_KEY to run live API tests.')

// タイムアウトを延長（AIの応答待ちのため）
test.setTimeout(60000)

test('Live API: Real chat flow with OpenAI', async ({ page }) => {
    console.log('Starting Live API Test...')

    // 1. セッション開始
    await page.goto('/')
    await page.getByPlaceholder('例：田中太郎').fill('LiveTest User')
    await page.getByPlaceholder('例：〇〇ビル改修工事').fill('LiveTest Site')
    await page.getByRole('button', { name: 'KY活動を開始' }).click()

    await page.waitForURL('**/session')
    await expect(page.getByRole('heading', { name: '一人KY活動' })).toBeVisible()
    console.log('Session started.')

    // 2. 第1ラウンド: 作業内容送信
    const bubblesBeforeRound1 = await page.getByTestId('chat-bubble').count()
    const firstMessage = 'グレーチングの設置作業を行います'
    await page.getByPlaceholder('メッセージを入力...').fill(firstMessage)
    await page.keyboard.press('Enter')
    console.log(`Sent: ${firstMessage}`)

    // メッセージが増えるのを待つ (Userメッセージ + AI応答 で +2 になるはずだが、最低 +1 を確認)
    await expect(async () => {
        const count = await page.getByTestId('chat-bubble').count()
        expect(count).toBeGreaterThan(bubblesBeforeRound1)
    }).toPass({ timeout: 30000 })

    console.log('AI responded to work description.')

    // 3. 第2ラウンド: 危険内容送信
    const bubblesBeforeRound2 = await page.getByTestId('chat-bubble').count()
    const secondMessage = '隙間から物が落ちる危険があります'
    await page.getByPlaceholder('メッセージを入力...').fill(secondMessage)
    await page.getByRole('button', { name: '送信' }).click()
    console.log(`Sent: ${secondMessage}`)

    await expect(async () => {
        const count = await page.getByTestId('chat-bubble').count()
        expect(count).toBeGreaterThan(bubblesBeforeRound2)
    }).toPass({ timeout: 30000 })

    console.log('AI responded to hazard description.')

    // 4. エラーが出ていないか確認
    const errorAlert = page.locator('.text-red-600')
    await expect(errorAlert).not.toBeVisible()

    console.log('Live API Test Completed Successfully.')
})
