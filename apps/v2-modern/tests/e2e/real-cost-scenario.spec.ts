import { test, expect, type Request as PWRequest, type Response } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const RUN_LIVE = process.env.RUN_LIVE_TESTS === '1'
const DRY_RUN = process.env.DRY_RUN === '1'
const SHOULD_SKIP = !RUN_LIVE && !DRY_RUN

// Skip logic: Run if LIVE is explicitly requested OR if DRY_RUN is requested
test.skip(SHOULD_SKIP, 'Set RUN_LIVE_TESTS=1 (real) or DRY_RUN=1 (mock) to run this test.')

// Force single worker for stability
test.describe.configure({ mode: 'serial' });

// Visual mode configuration
// If running in headed mode (test:visual), slow down operations for visibility
test.use({
    launchOptions: {
        slowMo: process.env.VISUAL_MODE ? 1000 : 0
    }
});

// --- Metrics Configuration ---
const METRICS = {
    startTime: 0,
    endTime: 0,
    aiResponseTimes: [] as number[],
    errors: 0,
    turns: 0,
    navigationSuccess: false,
    baseUrl: '',
}

// レポート保存先
const REPORT_ROOT = path.join(process.cwd(), 'reports', 'real-cost')

// 既存のログ配列
interface LogEntry {
    time: string
    speaker: string
    message: string
}

interface ApiTraceEntry {
    time: string
    method: string
    status: number
    url: string
    latencyMs?: number
    code?: string
    requestId?: string
    retriable?: boolean
    error?: string
    details?: string
}

// Initialize the log array properly
const conversationLog: LogEntry[] = []
const apiTrace: ApiTraceEntry[] = []
const failureDiagnostics: string[] = []
const requestStartTimes = new Map<PWRequest, number>()

function shortText(value: string, limit = 160): string {
    const normalized = value.replace(/\s+/g, ' ').trim()
    return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized
}

function escapeTableText(value: string): string {
    return value.replace(/\|/g, '\\|').replace(/\n/g, '<br>')
}

function resetRunState() {
    METRICS.startTime = 0
    METRICS.endTime = 0
    METRICS.aiResponseTimes = []
    METRICS.errors = 0
    METRICS.turns = 0
    METRICS.navigationSuccess = false
    METRICS.baseUrl = ''
    conversationLog.length = 0
    apiTrace.length = 0
    failureDiagnostics.length = 0
    requestStartTimes.clear()
}

function addFailureDiagnostic(message: string) {
    failureDiagnostics.push(message)
    console.error(`[FailureDiagnostic] ${message}`)
}

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

async function recordApiTrace(response: Response) {
    const request = response.request()
    if (!request.url().includes('/api/chat')) return

    const startedAt = requestStartTimes.get(request)
    requestStartTimes.delete(request)

    const entry: ApiTraceEntry = {
        time: new Date().toISOString().split('T')[1].slice(0, 8),
        method: request.method(),
        status: response.status(),
        url: request.url(),
        latencyMs: startedAt ? Date.now() - startedAt : undefined,
    }

    try {
        const payload = await response.json() as { code?: string; requestId?: string; retriable?: boolean; error?: string; details?: unknown }
        entry.code = payload.code
        entry.requestId = payload.requestId || response.headers()['x-request-id']
        entry.retriable = payload.retriable
        entry.error = payload.error
        if (payload.details) {
            try {
                entry.details = JSON.stringify(payload.details).slice(0, 500)
            } catch {
                entry.details = String(payload.details).slice(0, 500)
            }
        }
    } catch {
        // noop: JSONレスポンスでないケースは本文解析しない
        entry.requestId = response.headers()['x-request-id']
    }

    apiTrace.push(entry)

    if (entry.status >= 400) {
        METRICS.errors++
        addFailureDiagnostic(`API failure status=${entry.status} code=${entry.code ?? '-'} requestId=${entry.requestId ?? '-'} error=${entry.error ?? '-'} details=${entry.details ? shortText(entry.details, 160) : '-'}`)
    }
}

// Helper: Markdownレポート生成
function generateReport(status: 'PASS' | 'FAIL' | string) {
    METRICS.endTime = Date.now()
    const duration = ((METRICS.endTime - METRICS.startTime) / 1000).toFixed(1)

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const mode = DRY_RUN ? 'DRY-RUN' : 'LIVE'
    const reportDir = path.join(REPORT_ROOT, mode)
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true })
    }
    const reportPath = path.join(reportDir, `real-cost-${mode}-${timestamp}.md`)

    // メトリクス計算
    const avgResponseTime = METRICS.aiResponseTimes.length > 0
        ? (METRICS.aiResponseTimes.reduce((a, b) => a + b, 0) / METRICS.aiResponseTimes.length / 1000).toFixed(1)
        : 'N/A'

    // 評価スコア算出 (簡易ロジック)
    let score = 'A'
    if (METRICS.errors > 0 || !METRICS.navigationSuccess) score = 'C'
    else if (METRICS.turns > 8 || Number(duration) > 180) score = 'B'
    if (status !== 'PASS') score = 'D'

    const apiTraceRows = apiTrace.length > 0
        ? apiTrace.map(entry => {
            const note = entry.error
                ? `${entry.error}${entry.details ? ` details=${entry.details}` : ''}`
                : entry.url
            return `| ${entry.time} | ${entry.method} | ${entry.status} | ${entry.code ?? '-'} | ${entry.requestId ?? '-'} | ${entry.latencyMs ?? '-'} | ${escapeTableText(shortText(note, 140))} |`
        }).join('\n')
        : '| - | - | - | - | - | - | - |'

    const failureRows = failureDiagnostics.length > 0
        ? failureDiagnostics.map(item => `- ${item}`).join('\n')
        : '- なし'

    const markdown = `
# Real-Cost KY Test Report (${mode})

- **Date**: ${new Date().toISOString()}
- **Result**: ${status === 'PASS' ? '✅ PASS' : '❌ FAIL'}
- **Score**: ${score}
- **Base URL**: ${METRICS.baseUrl || process.env.LIVE_BASE_URL || 'http://localhost:5173'}
- **Failure Summary**: ${escapeTableText(shortText(status === 'PASS' ? 'none' : String(status), 200))}

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

## API Trace (/api/chat)
| Time | Method | Status | Code | Request ID | Latency ms | Note |
|---|---|---|---|---|---|---|
${apiTraceRows}

## Failure Diagnostics
${failureRows}

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
    resetRunState()
    METRICS.startTime = Date.now()

    page.on('request', (request: PWRequest) => {
        if (request.url().includes('/api/chat')) {
            requestStartTimes.set(request, Date.now())
        }
    })

    page.on('response', async (response: Response) => {
        await recordApiTrace(response)
    })

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
        try {
            METRICS.baseUrl = new URL(page.url()).origin
        } catch {
            // ignore
        }

        console.log('Filling Basic Info...')
        // data-testid を使用した堅牢なセレクタ
        const userNameInput = page.getByTestId('input-username')
        const siteNameInput = page.getByTestId('input-sitename')
        await expect(userNameInput).toBeVisible({ timeout: 15000 })
        await expect(siteNameInput).toBeVisible({ timeout: 15000 })
        await userNameInput.fill('RealTest User')
        await siteNameInput.fill('RealTest Site')

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
        let userTurn = 0

        // Helper: ユーザー入力とAI応答待ち
        async function sendUserMessage(text: string, expectedResponsePart?: string) {
            userTurn++
            try {
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
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error)
                addFailureDiagnostic(`Turn ${userTurn} failed. User="${shortText(text, 40)}" reason="${shortText(message, 180)}"`)
                throw error
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
            await sendUserMessage('周囲の養生が不十分で、火花が可燃物に届くためです')

            // 危険度選択UIが出る場合はそれを使い、出ない場合はテキストで送る
            let selectedRisk = false
            try {
                await expect(page.locator('text=危険度を選択').first()).toBeVisible({ timeout: 45000 })
                const risk5Button = page.locator('button').filter({ hasText: '重大' }).first()
                await expect(risk5Button).toBeEnabled()

                const countBefore = await assistantBubbles.count()
                const startWait = Date.now()
                await risk5Button.click()
                await recordLog('User', '(Selected Risk Level: 5)')

                await expect(async () => {
                    const countAfter = await assistantBubbles.count()
                    expect(countAfter).toBeGreaterThan(countBefore)
                }).toPass({ timeout: 30000 })

                const endWait = Date.now()
                METRICS.aiResponseTimes.push(endWait - startWait)
                const riskReply = await assistantBubbles.last().textContent() || ''
                await recordLog('AI', riskReply)
                selectedRisk = true
            } catch {
                selectedRisk = false
            }

            if (!selectedRisk) {
                await sendUserMessage('危険度は5です')
            }

            await sendUserMessage('対策は、消火器を作業地点から2m以内の通路側に設置し、スパッタシートで周囲の可燃物を隙間なく覆って養生します。火花の飛散範囲を確認します。')

            // 追加深掘りが来た場合の1回だけ補足
            const afterMeasures = await assistantBubbles.last().textContent().catch(() => '') || ''
            if (afterMeasures.includes('どのよう') || afterMeasures.includes('どこ') || afterMeasures.includes('具体的')) {
                await sendUserMessage('消火器はすぐ手が届く位置に置き、スパッタシートは火花が飛ぶ範囲を床と周囲の可燃物に固定して隙間が出ないようにします。')
            }

            await sendUserMessage('他にありません。')
        }

        // 4. 完了画面への遷移待ち
        const finishButton = page.getByTestId('button-complete-session')

        // ボタンが出ない場合は、行動目標/確定の追加メッセージで1〜2回だけ押し上げる
        const waitForFinishButton = async (timeoutMs: number): Promise<boolean> => {
            try {
                await finishButton.waitFor({ state: 'visible', timeout: timeoutMs })
                return true
            } catch {
                return false
            }
        }

        let finishVisible = await waitForFinishButton(30000)
        if (!finishVisible && !DRY_RUN) {
            await sendUserMessage('行動目標は「火気使用時の完全養生よし！」です。')
            finishVisible = await waitForFinishButton(30000)
        }
        if (!finishVisible && !DRY_RUN) {
            await sendUserMessage('はい、これで確定して終了してください。')
            finishVisible = await waitForFinishButton(30000)
        }
        if (!finishVisible) {
            const progressText = await page.locator('text=/作業・危険 \\(\\d+件\\)/').first().textContent().catch(() => null)
            addFailureDiagnostic(`button-complete-session did not appear. progress=${progressText ?? 'unknown'}`)
            throw new Error('button-complete-session did not appear')
        }

        await finishButton.click()
        await recordLog('User', '(Clicked Finish Button)')

        // 遷移待ち (URL or Element)
        try {
            await Promise.race([
                page.waitForURL('**/complete', { timeout: 30000 }),
                page.locator('text=KY活動完了').waitFor({ state: 'visible', timeout: 30000 })
            ])
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error)
            addFailureDiagnostic(`Completion page transition failed. ${shortText(message, 180)}`)
            throw error
        }

        await recordLog('System', 'Navigated to Complete page')
        METRICS.navigationSuccess = true

        // --- Phase 2.6 Evolution: Verify Feedback Features ---
        // フィードバックカードの出現待ち（API応答次第で表示されない場合もある）
        console.log('Checking for Feedback Cards...')
        try {
            const feedbackSection = page.locator('text=事後フィードバック').first()
            let feedbackVisible = false
            try {
                await feedbackSection.waitFor({ state: 'visible', timeout: 10000 })
                feedbackVisible = true
            } catch {
                feedbackVisible = false
            }

            if (feedbackVisible) {
                await recordLog('System', 'Feedback Section Visible')

                // 1. 良い点 (FeedbackCard)
                const praiseTitle = page.locator('text=今日のフィードバック').first()
                const praiseVisible = await praiseTitle.isVisible().catch(() => false)
                if (praiseVisible) {
                    const praiseText = await page.locator('div.bg-emerald-50 p.text-sm').nth(1).textContent() || 'N/A'
                    await recordLog('System', `[Feedback: Good Point] ${praiseText}`)
                }

                // 2. 危険の補足 (SupplementCard)
                const supplementHeader = page.locator('text=AI補足').first()
                if (await supplementHeader.count() > 0) {
                    const supplementText = await page.locator('div.border-indigo-200 p.text-sm').first().textContent() || 'N/A'
                    await recordLog('System', `[Feedback: Supplement] ${supplementText}`)
                } else {
                    await recordLog('System', 'Supplement Card NOT Found (Maybe AI suggested none?)')
                }

                // 3. 行動目標の添削 (GoalPolishCard)
                const polishHeader = page.locator('text=行動目標のブラッシュアップ')
                if (await polishHeader.count() > 0) {
                    await expect(polishHeader).toBeVisible()
                    const polishText = await page.locator('div.bg-blue-50 p.font-semibold').first().textContent() || 'N/A'
                    await recordLog('System', `[Feedback: Polish] ${polishText}`)

                    // 採用ボタンを押してみる
                    const adoptButton = page.getByText('採用する').first()
                    if (await adoptButton.count() > 0) {
                        await adoptButton.click()
                        await recordLog('System', 'Clicked Adopt Goal Button')
                        await page.waitForTimeout(500) // UI反映待ち
                    }
                }
            } else {
                await recordLog('System', 'Feedback Section NOT visible (API may be disabled or slow)')
            }
        } catch (e) {
            console.warn('Feedback verification failed (non-blocking):', e)
            await recordLog('System', 'Feedback check skipped due to error')
        }

        // ----------------------------------------------------

        // PDFボタン待ち
        await expect(page.locator('button:has-text("PDF")').first()).toBeVisible()
        await recordLog('System', 'PDF Download button visible')

        // Screenshot Capture
        const resultScreenshotPath = path.join(REPORT_ROOT, DRY_RUN ? 'DRY-RUN' : 'LIVE', `final-result-${Date.now()}.png`)
        await page.screenshot({ path: resultScreenshotPath, fullPage: true })
        await recordLog('System', `Saved screenshot to: ${resultScreenshotPath}`)

        generateReport('PASS')

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'FAIL'
        addFailureDiagnostic(`Unhandled test error: ${shortText(message, 200)}`)
        console.error('Test Failed:', error)
        generateReport('FAIL')
        throw error
    }
})
