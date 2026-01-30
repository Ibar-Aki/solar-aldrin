import { defineConfig, devices } from '@playwright/test';

// Ensure HOME is set for Playwright browser cache/user data on Windows.
const resolvedHome =
    process.env.HOME ??
    process.env.USERPROFILE ??
    (process.env.HOMEDRIVE && process.env.HOMEPATH
        ? `${process.env.HOMEDRIVE}${process.env.HOMEPATH}`
        : undefined);

if (!process.env.HOME && resolvedHome) {
    process.env.HOME = resolvedHome;
}

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:5173',
        trace: 'on-first-retry',
    },

    testMatch: /.*\.spec\.ts/,

    /* Configure projects for major browsers */
    projects: [
        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
        },
        {
            name: 'Mobile Safari',
            use: { ...devices['iPhone 13'] },
        },
    ],

    /* Run your local dev server before starting the tests */
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
    },
});
