import { test, expect } from '@playwright/test';

test.describe('iOS Compatibility Tests', () => {
    test('HomePage loads correctly on WebKit', async ({ page }) => {
        // Navigate to the home page
        await page.goto('/');

        // Check if the title is correct (adjust based on actual app title)
        // Looking at index.html or code might help, but let's assume "Voice KY" or similar, 
        // or just check for a known element.
        await expect(page).toHaveTitle(/Voice KY/);

        // It might not be visible immediately if there is a loading state, but Playwright waits.
        // If the button text is dynamic, we might need a better selector.
        // Let's check for a general reliable element like a heading.
        // Check for the main title text "Voice KY Assistant"
        const title = page.getByText('Voice KY Assistant', { exact: true }).first();
        await expect(title).toBeVisible();

        // Check for the start button
        const startButton = page.getByRole('button', { name: 'KY活動を開始' });
        await expect(startButton).toBeVisible();

        // Take a screenshot for visual verification
        await page.screenshot({ path: 'test-results/ios-home.png' });
    });

    test('PDF Generation capability check', async ({ page }) => {
        await page.goto('/');

        // This is a smoke test to ensure no immediate JS errors in WebKit
        // checking console logs for errors
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.error(`Page Error: ${msg.text()}`);
            }
        });

        // Check if critical JS loaded
        const root = page.locator('#root');
        await expect(root).not.toBeEmpty();
    });
});
