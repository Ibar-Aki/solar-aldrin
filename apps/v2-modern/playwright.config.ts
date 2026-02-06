import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

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

const isLiveRun = process.env.RUN_LIVE_TESTS === '1';

function inferPagesUrl(): string | undefined {
    try {
        const tomlPath = path.join(process.cwd(), 'wrangler.toml');
        if (!fs.existsSync(tomlPath)) return undefined;
        const toml = fs.readFileSync(tomlPath, 'utf8');
        const match = toml.match(/^\s*name\s*=\s*"([^"]+)"\s*$/m);
        const name = match?.[1]?.trim();
        if (!name) return undefined;
        return `https://${name}.pages.dev`;
    } catch {
        return undefined;
    }
}

const liveBaseUrl = process.env.LIVE_BASE_URL?.trim() || inferPagesUrl();
if (isLiveRun && !liveBaseUrl) {
    throw new Error('RUN_LIVE_TESTS=1 の場合は LIVE_BASE_URL を設定するか、wrangler.toml に name を設定してください。');
}

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL: isLiveRun ? liveBaseUrl : 'http://localhost:5173',
        trace: 'on-first-retry',
    },

    testMatch: /.*\.spec\.ts/,

    /* Configure projects for major browsers */
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
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
    webServer: isLiveRun
        ? undefined
        : {
            command: 'npm run dev',
            url: 'http://localhost:5173',
            reuseExistingServer: !process.env.CI,
            timeout: 120 * 1000,
            env: {
                ...process.env,
                ...(process.env.VITE_API_TOKEN ? { VITE_API_TOKEN: process.env.VITE_API_TOKEN } : {}),
            },
        },
});
