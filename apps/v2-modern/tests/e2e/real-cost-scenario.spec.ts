import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const RUN_LIVE = process.env.RUN_LIVE_TESTS === '1'
const DRY_RUN = process.env.DRY_RUN === '1'
const HAS_OPENAI_KEY = Boolean(process.env.OPENAI_API_KEY)
const SHOULD_SKIP = (!RUN_LIVE && !DRY_RUN) || (RUN_LIVE && !DRY_RUN && !HAS_OPENAI_KEY)

// Skip logic: Run if LIVE is explicitly requested OR if DRY_RUN is requested
test.skip(SHOULD_SKIP, 'Set RUN_LIVE_TESTS=1 (real) with OPENAI_API_KEY, or DRY_RUN=1 (mock) to run this test.')

// Force single worker for stability
test.describe.configure({ mode: 'serial' });

// --- Metrics Configuration ---
const METRICS = {
    startTime: 0,
    endTime: 0,
    aiResponseTimes: [] as number[],
    errors: 0,
    turns: 0,
    navigationSuccess: false
}

// レポート保存先
const REPORT_DIR = path.join(process.cwd(), 'reports')

// 既存のログ配列
interface LogEntry {
    time: string
    speaker: string
    message: string
}
// Initialize the log array properly
const conversationLog: LogEntry[] = []

// Helper: ログ記録
async function recordLog(speaker: string, message: string) {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 8) // HH:mm:ss
    conversationLog.push({ time: timestamp, speaker, message })

    // エラー検知
    if (speaker === 'AI' && (message.includes('申し訳ありません') || message.includes('エラー'))) {
        METRICS.errors++
    }
    // ターン数カウント (AIの発言を1ターンとする)
    if (speaker === 'AI') {
        METRICS.turns++
    }
}

// Helper: Markdownレポート生成
function generateReport(status: 'PASS' | 'FAIL' | string) {
    METRICS.endTime = Date.now()
    const duration = ((METRICS.endTime - METRICS.startTime) / 1000).toFixed(1)

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    if (!fs.existsSync(REPORT_DIR)) {
        fs.mkdirSync(REPORT_DIR, { recursive: true })
    }
    const mode = DRY_RUN ? 'DRY-RUN' : 'LIVE'
    const reportPath = path.join(REPORT_DIR, `real-cost-${mode}-${timestamp}.md`)

    // メトリクス計算
    const avgResponseTime = METRICS.aiResponseTimes.length > 0
        ? (METRICS.aiResponseTimes.reduce((a, b) => a + b, 0) / METRICS.aiResponseTimes.length / 1000).toFixed(1)
        : 'N/A'

    // 評価スコア算出 (簡易ロジック)
    let score = 'A'
    if (METRICS.errors > 0 || !METRICS.navigationSuccess) score = 'C'
    else if (METRICS.turns > 8 || Number(duration) > 180) score = 'B'
    if (status !== 'PASS') score = 'D'

    const markdown = `
# Real-Cost KY Test Report (${mode})

- **Date**: ${new Date().toISOString()}
- **Result**: ${status === 'PASS' ? '✅ PASS' : '❌ FAIL'}
- **Score**: ${score}

## Metrics Dashboard
| Metric | Value | Target | Status |
|---|---|---|---|
| **Total Duration** | ${duration}s | < 120s | ${Number(duration) < 120 ? '🟢' : '🟡'} |
| **Avg AI Response** | ${avgResponseTime}s | < 5s | ${Number(avgResponseTime) < 5 ? '🟢' : '🟡'} |
| **Conversation Turns** | ${METRICS.turns} | 3-5 | ${METRICS.turns <= 5 ? '🟢' : (METRICS.turns > 8 ? '🔴' : '🟡')} |
| **Errors (AI/System)** | ${METRICS.errors} | 0 | ${METRICS.errors === 0 ? '🟢' : '🔴'} |
| **Nav Success** | ${METRICS.navigationSuccess ? 'Yes' : 'No'} | Yes | ${METRICS.navigationSuccess ? '🟢' : '🔴'} |

## Conversation Log
| Time | Speaker | Message |
|---|---|---|
${conversationLog.map(log => `| ${log.time} | **${log.speaker}** | ${log.message.replace(/\n/g, '<br>').slice(0, 100)}${log.message.length > 100 ? '...' : ''} |`).join('\n')}

## Analysis
- **Flow Completeness**: ${METRICS.navigationSuccess ? 'Full flow completed' : 'Stopped mid-flow'}
- **AI Responsiveness**: Verified via ChatBubble detection.
`
    fs.writeFileSync(reportPath, markdown)
    console.log(`Report generated: ${reportPath}`)
}

test.use({ viewport: { width: 1280, height: 720 } })

test('Real-Cost: Full KY Scenario with Reporting', async ({ page }) => {
    // タイムアウトを少し長めに設定 (5分)
    test.setTimeout(300 * 1000)
    METRICS.startTime = Date.now()

    console.log(`--- STARTING TEST (Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}) ---`)
    await recordLog('System', `Test Started: 溶接作業シナリオ (Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'})`)

    // Dry Run モック設定
    if (DRY_RUN) {
        let turnCount = 0
        await page.route('**/api/chat', async route => {
            turnCount++
            const mockResponses = [
                { reply: "はい、承知しました。" }, // Turn 0
                {
                    reply: "溶接作業ですね。どのような危険が予想されますか？",
                    extracted: { workDescription: "配管の溶接作業" }
                },
                {
                    reply: "火花による引火の危険ですね。それはなぜ起こると思いますか？",
                    extracted: { hazardDescription: "火花が飛散して周囲の可燃物に引火する恐れ" }
                },
                {
                    reply: "養生不足が原因で、危険度は5ですね。対策はどうしますか？",
                    extracted: {
                        whyDangerous: ["周囲に養生が不十分なため"],
                        riskLevel: 5
                    }
                },
                {
                    reply: "消火器とスパッタシートですね。他にはありますか？",
                    extracted: {
                        countermeasures: ["消火器をすぐに使える位置に配置", "スパッタシートで隙間なく養生"],
                        nextAction: 'ask_goal' // Commit trigger
                    }
                },
                {
                    reply: "了解しました。行動目標を設定して終了してください。",
                    extracted: {
                        actionGoal: "火気使用時の完全養生よし！",
                        nextAction: 'completed'
                    },
                    needsWrapUp: true
                }
            ]
            // 単純なシーケンス応答
            const index = Math.min(turnCount, mockResponses.length - 1)
            const response = mockResponses[index]
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify(response)
            })
            console.log(`[Mock API] Responded to turn ${turnCount} (Index ${index})`)
        })
    }

    try {
        console.log('Navigating to root...')
        // 1. 基本情報入力 (Loginではなく、KY開始画面)
        await page.goto('/', { waitUntil: 'networkidle' })
        console.log('Page loaded. URL:', page.url())

        console.log('Filling Basic Info...')
        // data-testid を使用した堅牢なセレクタ
        await page.getByTestId('input-username').fill('RealTest User')
        await page.getByTestId('input-sitename').fill('RealTest Site')

        // 状態更新待ち: 明示的なWaitForTimeoutは削除し、ボタンの状態をアサートする
        const startButton = page.getByTestId('button-start-ky')
        await expect(startButton).toBeEnabled()

        console.log('Clicking Start Button...')
        await startButton.click()

        // セッション画面への遷移待ち
        // URL遷移だけでなく、チャット入力欄の出現を待つことで確実にロード完了を検知
        await page.waitForURL('**/session', { timeout: 60000 })
        const chatInput = page.getByTestId('input-chat-message')
        await expect(chatInput).toBeVisible({ timeout: 10000 })

        await recordLog('System', 'Session started')
        console.log('Session started, URL:', page.url())
        const assistantBubbles = page.locator('[data-testid="chat-bubble"][data-role="assistant"]')

        // AI応答待ち (吹き出しが増えるのを待つ)
        const startWait = Date.now()
        // 初期メッセージの吹き出しを待つ
        await expect(async () => {
            expect(await assistantBubbles.count()).toBeGreaterThan(0)
        }).toPass({ timeout: 30000 })

        const endWait = Date.now()
        METRICS.aiResponseTimes.push(endWait - startWait)

        // 最新のAI応答を取得
        const initialBubble = assistantBubbles.last()
        const initialText = await initialBubble.textContent() || ''
        await recordLog('AI', initialText)

        const sendButton = page.getByTestId('button-send-message')

        // Helper: ユーザー入力とAI応答待ち
        async function sendUserMessage(text: string, expectedResponsePart?: string) {
            await chatInput.fill(text)
            await expect(sendButton).toBeEnabled() // 送信ボタンが有効になるのを待つ
            await sendButton.click()
            await recordLog('User', text)

            // AI応答待ち
            if (expectedResponsePart) {
                // 特定のテキストが画面に出るのを待つ (より確実)
                await expect(page.locator(`text=${expectedResponsePart}`)).toBeVisible({ timeout: 30000 })
                await recordLog('AI', `(Verified presence of: ${expectedResponsePart})`)
            } else {
                // 汎用Wait (吹き出しが増えるのを待つ)
                const startWait = Date.now()
                const countBefore = await assistantBubbles.count()
                await expect(async () => {
                    const countAfter = await assistantBubbles.count()
                    expect(countAfter).toBeGreaterThan(countBefore)
                }).toPass({ timeout: 30000 })
                const endWait = Date.now()
                METRICS.aiResponseTimes.push(endWait - startWait)
            }

            // 最新のAI応答を取得
            const latestBubble = assistantBubbles.last()
            const textContent = await latestBubble.textContent() || ''
            if (!expectedResponsePart) {
                await recordLog('AI', textContent)
            }
        }

        // シナリオ開始
        // Dry Runの時は期待値を指定して安定化
        if (DRY_RUN) {
            await sendUserMessage('配管の溶接作業を行います', '溶接作業ですね')
            await sendUserMessage('火花が飛散して周囲の可燃物に引火する危険があります', '火花による引火')
            await sendUserMessage('周囲に養生が不十分なためです。危険度は一番高い5です', '養生不足が原因で、危険度は5ですね')
            await sendUserMessage('消火器をすぐに使える位置に配置し、スパッタシートで隙間なく養生します', '消火器とスパッタシート')
            await sendUserMessage('ありません。行動目標は「火気使用時の完全養生よし！」にします。これで内容を確定して終了してください。', '行動目標を設定して終了')
        } else {
            await sendUserMessage('配管の溶接作業を行います')
            await sendUserMessage('火花が飛散して周囲の可燃物に引火する危険があります')
            await sendUserMessage('周囲に養生が不十分なためです。危険度は一番高い5です')
            await sendUserMessage('消火器をすぐに使える位置に配置し、スパッタシートで隙間なく養生します')
            await sendUserMessage('ありません。行動目標は「火気使用時の完全養生よし！」にします。これで内容を確定して終了してください。')
        }

        // 4. 完了画面への遷移待ち
        const finishButton = page.getByTestId('button-complete-session')

        // AIがボタンを出すまで少し待つ
        await finishButton.waitFor({ state: 'visible', timeout: 20000 })
        await finishButton.click()
        await recordLog('User', '(Clicked Finish Button)')

        // 遷移待ち (URL or Element)
        await Promise.race([
            page.waitForURL('**/complete', { timeout: 30000 }),
            page.locator('text=KY活動完了').waitFor({ state: 'visible', timeout: 30000 })
        ])

        await recordLog('System', 'Navigated to Complete page')
        METRICS.navigationSuccess = true

        // PDFボタン待ち
        await expect(page.locator('button:has-text("PDF")').first()).toBeVisible()
        await recordLog('System', 'PDF Download button visible')

        generateReport('PASS')

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'FAIL'
        console.error('Test Failed:', error)
        generateReport(message)
        throw error
    }
})
