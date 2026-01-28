import { test, expect } from '@playwright/test'

test('PDF debug preview visual regression', async ({ page }) => {
    await page.goto('/debug/pdf')
    await page.evaluate(async () => {
        if (document.fonts?.ready) {
            await document.fonts.ready
        }
    })

    const standardViewer = page.getByTestId('pdf-viewer-standard')
    await expect(standardViewer).toHaveAttribute('data-ready', 'true')
    await expect(standardViewer.locator('canvas').first()).toBeVisible()
    await expect(standardViewer).toHaveScreenshot('pdf-standard.png', {
        animations: 'disabled',
        caret: 'hide',
    })

    const longViewer = page.getByTestId('pdf-viewer-long')
    await expect(longViewer).toHaveAttribute('data-ready', 'true')
    await expect(longViewer.locator('canvas').first()).toBeVisible()
    await expect(longViewer).toHaveScreenshot('pdf-long.png', {
        animations: 'disabled',
        caret: 'hide',
    })
})
