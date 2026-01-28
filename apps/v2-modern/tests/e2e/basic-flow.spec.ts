import { test, expect } from '@playwright/test'
import { basicFlowResponses } from './mocks/ai-responses'

test('Happy path: start session to PDF download', async ({ page }) => {
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

    await page.goto('/')

    await page.getByPlaceholder('例：田中太郎').fill('テスト太郎')
    await page.getByPlaceholder('例：〇〇ビル改修工事').fill('テスト現場')
    await page.getByRole('button', { name: 'KY活動を開始' }).click()

    await page.waitForURL('**/session')
    await expect(page.getByRole('heading', { name: '一人KY活動' })).toBeVisible()

    await page.getByPlaceholder('メッセージを入力...').fill('高所作業を行います')
    await page.getByRole('button', { name: '送信' }).click()

    const riskSelector = page.getByText('危険度を選択').locator('..')
    await expect(riskSelector).toBeVisible()
    await riskSelector.getByRole('button', { name: '3' }).click()

    const finishButton = page.getByRole('button', { name: '行動目標を決めて終了する' })
    await expect(finishButton).toBeVisible()
    await finishButton.click()

    await page.waitForURL('**/complete')
    await page.getByPlaceholder('例：高所作業時は必ず二丁掛けを徹底する').fill('安全帯の二丁掛けを徹底する')
    await page.getByLabel('指差し呼称を実施した').check()
    await page.getByLabel('上記の対策をすべて実施する').check()

    await page.getByRole('button', { name: 'KY活動を完了する' }).click()

    const pdfButton = page.getByRole('button', { name: '📄 PDFをダウンロード' })
    await expect(pdfButton).toBeVisible()

    expect(callCount).toBe(2)
})
