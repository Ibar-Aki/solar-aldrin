import { test, expect, type Request as PWRequest, type Response } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const RUN_LIVE = process.env.RUN_LIVE_TESTS === '1'
const DRY_RUN = process.env.DRY_RUN === '1'
const SHOULD_SKIP = !RUN_LIVE && !DRY_RUN
const LIVE_PREFLIGHT_PASSED = process.env.LIVE_PREFLIGHT_PASSED === '1'

function readEnvLikeValue(filePath: string, key: string): string | null {
    if (!fs.existsSync(filePath)) return null
    const rows = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
    for (const row of rows) {
        const match = row.match(new RegExp(`^\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=\\s*(.*)\\s*$`))
        if (!match) continue
        const raw = match[1]?.trim() ?? ''
        if (!raw) return null
        if (
            (raw.startsWith('"') && raw.endsWith('"')) ||
            (raw.startsWith("'") && raw.endsWith("'"))
        ) {
            return raw.slice(1, -1).trim() || null
        }
        return raw
    }
    return null
}

const LIVE_API_TOKEN_INFO = (() => {
    const envToken = process.env.VITE_API_TOKEN?.trim()
    if (envToken) {
        return { token: envToken, source: 'env' as const }
    }
    if (!RUN_LIVE) {
        return { token: '', source: 'none' as const }
    }

    const devVarsToken = readEnvLikeValue(path.join(process.cwd(), '.dev.vars'), 'API_TOKEN') ?? ''
    if (devVarsToken) {
        // 実費テストの開始前に環境変数へ昇格しておく（テスト中のフォールバック分岐をなくす）
        process.env.VITE_API_TOKEN = devVarsToken
        return { token: devVarsToken, source: 'devvars' as const }
    }
    return { token: '', source: 'none' as const }
})()
const LIVE_API_TOKEN = LIVE_API_TOKEN_INFO.token

// LIVEは上流混雑・リトライ等で 30s を超えることがあるため、待ち時間を長めに取る。
const CHAT_WAIT_TIMEOUT_MS = RUN_LIVE ? 90_000 : 30_000
const SCENARIO_TIMEOUT_MS = RUN_LIVE ? 900_000 : 300_000
const EXPECTED_SERVER_POLICY_VERSION = process.env.LIVE_EXPECTED_POLICY_VERSION?.trim() || '2026-02-11-a-b-observability-1'
const LIVE_EXPECTED_RESPONSE_FORMAT_OVERRIDE = process.env.LIVE_EXPECTED_RESPONSE_FORMAT?.trim() || ''
const EXPECTED_SERVER_PARSE_RECOVERY_ENABLED = (() => {
    const raw = process.env.LIVE_EXPECTED_PARSE_RECOVERY_ENABLED?.trim().toLowerCase()
    if (!raw) return true
    return raw === '1' || raw === 'true'
})()
const LIVE_EXPECTED_OPENAI_RETRY_COUNT_OVERRIDE = (() => {
    const raw = process.env.LIVE_EXPECTED_OPENAI_RETRY_COUNT?.trim()
    if (!raw) return null
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : null
})()
const LIVE_EXPECTED_MAX_TOKENS_OVERRIDE = (() => {
    const raw = process.env.LIVE_EXPECTED_MAX_TOKENS?.trim()
    if (!raw) return null
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : null
})()

function expectedResponseFormatByProvider(provider: string | undefined): 'json_object' | 'json_schema_strict' {
    return provider === 'gemini' ? 'json_object' : 'json_schema_strict'
}

function expectedRetryCountByProvider(provider: string | undefined): number {
    if (LIVE_EXPECTED_OPENAI_RETRY_COUNT_OVERRIDE !== null) {
        return LIVE_EXPECTED_OPENAI_RETRY_COUNT_OVERRIDE
    }
    return provider === 'gemini' ? 0 : 1
}

function expectedMaxTokensByProvider(provider: string | undefined): number {
    if (LIVE_EXPECTED_MAX_TOKENS_OVERRIDE !== null) {
        return LIVE_EXPECTED_MAX_TOKENS_OVERRIDE
    }
    return provider === 'gemini' ? 700 : 900
}

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
    uiReadyTimes: [] as number[],
    errors: 0,
    turns: 0,
    navigationSuccess: false,
    baseUrl: '',
    retryButtonClicks: 0,
}

const API_TOKEN_STORAGE_KEY = 'voice-ky-v2.api_token'

// レポート保存先
const REPORT_ROOT = path.join(process.cwd(), 'reports', 'real-cost')

// 既存のログ配列
interface LogEntry {
    time: string
    speaker: string
    message: string
}

type FailureClass = 'auth_config' | 'runtime_quality' | 'policy_mismatch' | 'other'

interface ApiTraceEntry {
    time: string
    method: string
    status: number
    url: string
    latencyMs?: number
    code?: string
    requestId?: string
    retriable?: boolean
    retryAfterSec?: number
    replyType?: string
    replyLen?: number
    payloadKeys?: string
    error?: string
    details?: string
    usageTotalTokens?: number
    aiRequestCount?: number
    aiHttpAttempts?: number
    aiDurationMs?: number
    openaiRequestCount?: number
    openaiHttpAttempts?: number
    openaiDurationMs?: number
    parseRetryAttempted?: boolean
    parseRetrySucceeded?: boolean
    serverPolicyVersion?: string
    serverAiProvider?: string
    serverResponseFormat?: string
    serverParseRecoveryEnabled?: boolean
    serverAiRetryCount?: number
    serverOpenaiRetryCount?: number
    serverMaxTokens?: number
    serverPolicyViolation?: boolean
    serverProfileName?: string
    serverProfileRetryCount?: number
    serverProfileMaxTokens?: number
    serverProfileSoftTimeoutMs?: number
    serverProfileHardTimeoutMs?: number
    failureClass?: FailureClass
}

// Initialize the log array properly
const conversationLog: LogEntry[] = []
const apiTrace: ApiTraceEntry[] = []
const failureDiagnostics: string[] = []
const browserConsole: string[] = []
const pageErrors: string[] = []
let authHeaderObserved: boolean = false
let fatalInfraError: string | null = null
const requestStartTimes = new Map<PWRequest, number>()

function shortText(value: string, limit = 160): string {
    const normalized = value.replace(/\s+/g, ' ').trim()
    return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized
}

function escapeTableText(value: string): string {
    return value.replace(/\|/g, '\\|').replace(/\n/g, '<br>')
}

const AUTH_FAILURE_CODES = new Set(['AUTH_REQUIRED', 'AUTH_INVALID', 'OPENAI_AUTH_ERROR', 'GEMINI_AUTH_ERROR'])
const RUNTIME_QUALITY_CODES = new Set(['AI_RESPONSE_INVALID_JSON', 'AI_RESPONSE_INVALID_SCHEMA', 'AI_TIMEOUT', 'AI_UPSTREAM_ERROR'])

function classifyFailure(entry: ApiTraceEntry): FailureClass {
    if (entry.serverPolicyViolation) return 'policy_mismatch'
    if (entry.code && AUTH_FAILURE_CODES.has(entry.code)) return 'auth_config'
    if (entry.code && RUNTIME_QUALITY_CODES.has(entry.code)) return 'runtime_quality'
    if (entry.status === 401 || entry.status === 403) return 'auth_config'
    if (entry.status >= 500 || entry.status === 429) return 'runtime_quality'
    return 'other'
}

function resetRunState() {
    METRICS.startTime = 0
    METRICS.endTime = 0
    METRICS.uiReadyTimes = []
    METRICS.errors = 0
    METRICS.turns = 0
    METRICS.navigationSuccess = false
    METRICS.baseUrl = ''
    METRICS.retryButtonClicks = 0
    conversationLog.length = 0
    apiTrace.length = 0
    failureDiagnostics.length = 0
    browserConsole.length = 0
    pageErrors.length = 0
    requestStartTimes.clear()
    authHeaderObserved = false
    fatalInfraError = null
}

function addFailureDiagnostic(message: string) {
    failureDiagnostics.push(message)
    console.error(`[FailureDiagnostic] ${message}`)
}

function setFatalInfraError(message: string) {
    if (fatalInfraError) return
    fatalInfraError = message
    addFailureDiagnostic(`fatal-infra: ${message}`)
}

function assertNoFatalInfraError() {
    if (!fatalInfraError) return
    throw new Error(fatalInfraError)
}

// Helper: ログ記録
async function recordLog(speaker: string, message: string) {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 8) // HH:mm:ss
    conversationLog.push({ time: timestamp, speaker, message })

    // エラー検知:
    // テキスト一致ベースは誤検知・二重カウントが起きやすいので、基本は API Trace (status>=400) に寄せる。
    // ただし旧実装の「200で内部エラー文言」だけは保険としてカウントする。
    if (speaker === 'AI' && message.includes('システムの内部エラーが発生しました')) {
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
        const retryAfterRaw = response.headers()['retry-after']
        if (retryAfterRaw) {
            const retryAfterParsed = Number.parseInt(retryAfterRaw, 10)
            entry.retryAfterSec = Number.isFinite(retryAfterParsed) ? retryAfterParsed : undefined
        }

        // Some responses can be non-JSON / contain unexpected chars; prefer text then parse.
        const rawText = await response.text()
        const parsedJson = (() => {
            try {
                return JSON.parse(rawText)
            } catch {
                return null
            }
        })()

        const payload = (parsedJson ?? {}) as {
            code?: string
            requestId?: string
            retriable?: boolean
            error?: string
            details?: unknown
            usage?: { totalTokens?: number }
            meta?: {
                ai?: { requestCount?: number; httpAttempts?: number; durationMs?: number }
                openai?: { requestCount?: number; httpAttempts?: number; durationMs?: number }
                parseRetry?: { attempted?: boolean; succeeded?: boolean }
                server?: {
                    policyVersion?: string
                    aiProvider?: string
                    responseFormat?: string
                    parseRecoveryEnabled?: boolean
                    aiRetryCount?: number
                    openaiRetryCount?: number
                    maxTokens?: number
                    profileName?: string
                    profileRetryCount?: number
                    profileMaxTokens?: number
                    profileSoftTimeoutMs?: number
                    profileHardTimeoutMs?: number
                }
            }
        }
        entry.code = payload.code
        entry.requestId = payload.requestId || response.headers()['x-request-id']
        entry.retriable = payload.retriable
        entry.error = payload.error

        const payloadAny = payload as unknown as Record<string, unknown>
        entry.payloadKeys = Object.keys(payloadAny).slice(0, 12).join(',')
        const replyValue = (payloadAny as { reply?: unknown }).reply
        entry.replyType = replyValue === null ? 'null' : typeof replyValue
        entry.replyLen = typeof replyValue === 'string' ? replyValue.length : undefined

        entry.usageTotalTokens = typeof payload.usage?.totalTokens === 'number' ? payload.usage.totalTokens : undefined
        entry.aiRequestCount = typeof payload.meta?.ai?.requestCount === 'number'
            ? payload.meta.ai.requestCount
            : undefined
        entry.aiHttpAttempts = typeof payload.meta?.ai?.httpAttempts === 'number'
            ? payload.meta.ai.httpAttempts
            : undefined
        entry.aiDurationMs = typeof payload.meta?.ai?.durationMs === 'number'
            ? payload.meta.ai.durationMs
            : undefined
        entry.openaiRequestCount = entry.aiRequestCount ?? (
            typeof payload.meta?.openai?.requestCount === 'number' ? payload.meta.openai.requestCount : undefined
        )
        entry.openaiHttpAttempts = entry.aiHttpAttempts ?? (
            typeof payload.meta?.openai?.httpAttempts === 'number' ? payload.meta.openai.httpAttempts : undefined
        )
        entry.openaiDurationMs = entry.aiDurationMs ?? (
            typeof payload.meta?.openai?.durationMs === 'number' ? payload.meta.openai.durationMs : undefined
        )
        entry.parseRetryAttempted = typeof payload.meta?.parseRetry?.attempted === 'boolean' ? payload.meta.parseRetry.attempted : undefined
        entry.parseRetrySucceeded = typeof payload.meta?.parseRetry?.succeeded === 'boolean' ? payload.meta.parseRetry.succeeded : undefined
        entry.serverPolicyVersion = typeof payload.meta?.server?.policyVersion === 'string' ? payload.meta.server.policyVersion : undefined
        entry.serverAiProvider = typeof payload.meta?.server?.aiProvider === 'string' ? payload.meta.server.aiProvider : undefined
        entry.serverResponseFormat = typeof payload.meta?.server?.responseFormat === 'string' ? payload.meta.server.responseFormat : undefined
        entry.serverParseRecoveryEnabled = typeof payload.meta?.server?.parseRecoveryEnabled === 'boolean'
            ? payload.meta.server.parseRecoveryEnabled
            : undefined
        entry.serverAiRetryCount = typeof payload.meta?.server?.aiRetryCount === 'number'
            ? payload.meta.server.aiRetryCount
            : undefined
        entry.serverOpenaiRetryCount = typeof payload.meta?.server?.openaiRetryCount === 'number'
            ? payload.meta.server.openaiRetryCount
            : undefined
        entry.serverMaxTokens = typeof payload.meta?.server?.maxTokens === 'number'
            ? payload.meta.server.maxTokens
            : undefined
        entry.serverProfileName = typeof payload.meta?.server?.profileName === 'string'
            ? payload.meta.server.profileName
            : undefined
        entry.serverProfileRetryCount = typeof payload.meta?.server?.profileRetryCount === 'number'
            ? payload.meta.server.profileRetryCount
            : undefined
        entry.serverProfileMaxTokens = typeof payload.meta?.server?.profileMaxTokens === 'number'
            ? payload.meta.server.profileMaxTokens
            : undefined
        entry.serverProfileSoftTimeoutMs = typeof payload.meta?.server?.profileSoftTimeoutMs === 'number'
            ? payload.meta.server.profileSoftTimeoutMs
            : undefined
        entry.serverProfileHardTimeoutMs = typeof payload.meta?.server?.profileHardTimeoutMs === 'number'
            ? payload.meta.server.profileHardTimeoutMs
            : undefined

        const shouldValidateServerPolicy =
            RUN_LIVE &&
            (entry.status === 200 || entry.code === 'AI_RESPONSE_INVALID_JSON' || entry.code === 'AI_RESPONSE_INVALID_SCHEMA')

        if (shouldValidateServerPolicy) {
            const mismatchReasons: string[] = []
            const expectedResponseFormat = LIVE_EXPECTED_RESPONSE_FORMAT_OVERRIDE
                || expectedResponseFormatByProvider(entry.serverAiProvider)
            const expectedResponseFormatSource = LIVE_EXPECTED_RESPONSE_FORMAT_OVERRIDE
                ? 'env(LIVE_EXPECTED_RESPONSE_FORMAT)'
                : `auto(provider=${entry.serverAiProvider ?? 'openai'})`
            const expectedRetryCount = expectedRetryCountByProvider(entry.serverAiProvider)
            const expectedMaxTokens = expectedMaxTokensByProvider(entry.serverAiProvider)
            const actualRetryCount = entry.serverAiRetryCount ?? entry.serverOpenaiRetryCount
            if (entry.serverPolicyVersion !== EXPECTED_SERVER_POLICY_VERSION) {
                mismatchReasons.push(`policyVersion expected=${EXPECTED_SERVER_POLICY_VERSION} actual=${entry.serverPolicyVersion ?? 'missing'}`)
            }
            if (entry.serverResponseFormat !== expectedResponseFormat) {
                mismatchReasons.push(`responseFormat expected=${expectedResponseFormat} source=${expectedResponseFormatSource} actual=${entry.serverResponseFormat ?? 'missing'}`)
            }
            if (entry.serverParseRecoveryEnabled !== EXPECTED_SERVER_PARSE_RECOVERY_ENABLED) {
                mismatchReasons.push(`parseRecoveryEnabled expected=${EXPECTED_SERVER_PARSE_RECOVERY_ENABLED} actual=${entry.serverParseRecoveryEnabled ?? 'missing'}`)
            }
            if (actualRetryCount !== expectedRetryCount) {
                mismatchReasons.push(`aiRetryCount expected=${expectedRetryCount} actual=${actualRetryCount ?? 'missing'}`)
            }
            if (entry.serverMaxTokens !== expectedMaxTokens) {
                mismatchReasons.push(`maxTokens expected=${expectedMaxTokens} actual=${entry.serverMaxTokens ?? 'missing'}`)
            }

            if (mismatchReasons.length > 0) {
                entry.serverPolicyViolation = true
                entry.failureClass = 'policy_mismatch'
                setFatalInfraError(
                    `chat meta.server mismatch (requestId=${entry.requestId ?? '-'}): ${mismatchReasons.join(', ')}`
                )
            } else {
                entry.serverPolicyViolation = false
            }
        }

        if (payload.details) {
            try {
                entry.details = JSON.stringify(payload.details).slice(0, 500)
            } catch {
                entry.details = String(payload.details).slice(0, 500)
            }
        }
        if (!parsedJson) {
            // Keep a short preview so the report can reveal "200 but not JSON" cases.
            entry.details = `non_json_response_preview=${shortText(rawText ?? '', 200)}`
        }
    } catch {
        // noop: JSONレスポンスでないケースは本文解析しない
        entry.requestId = response.headers()['x-request-id']
    }

    apiTrace.push(entry)

    if (entry.status >= 400) {
        entry.failureClass = classifyFailure(entry)
        METRICS.errors++
        addFailureDiagnostic(`API failure status=${entry.status} code=${entry.code ?? '-'} requestId=${entry.requestId ?? '-'} error=${entry.error ?? '-'} details=${entry.details ? shortText(entry.details, 160) : '-'}`)

        if (RUN_LIVE && entry.status === 401 && entry.code === 'AUTH_INVALID') {
            setFatalInfraError(`LIVE認証エラー（AUTH_INVALID, requestId=${entry.requestId ?? '-'}）。VITE_API_TOKEN と Worker API_TOKEN の不一致の可能性があります。`)
        }
        if (RUN_LIVE && entry.status === 502 && (entry.code === 'OPENAI_AUTH_ERROR' || entry.code === 'GEMINI_AUTH_ERROR')) {
            if (entry.code === 'GEMINI_AUTH_ERROR') {
                setFatalInfraError(`Gemini認証エラー（GEMINI_AUTH_ERROR, requestId=${entry.requestId ?? '-'}）。Worker側の GEMINI_API_KEY が無効または期限切れの可能性があります。`)
            } else {
                setFatalInfraError(`OpenAI認証エラー（OPENAI_AUTH_ERROR, requestId=${entry.requestId ?? '-'}）。Worker側の OPENAI_API_KEY が無効または期限切れの可能性があります。`)
            }
        }
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
    // Perf KPI は UI状態遷移ではなく、/api/chat の実レスポンス遅延で集計する。
    const successfulApiLatencies = apiTrace
        .filter(entry => entry.status < 400 && typeof entry.latencyMs === 'number')
        .map(entry => entry.latencyMs as number)
    const fallbackApiLatencies = apiTrace
        .filter(entry => typeof entry.latencyMs === 'number')
        .map(entry => entry.latencyMs as number)
    const effectiveApiLatencies = successfulApiLatencies.length > 0 ? successfulApiLatencies : fallbackApiLatencies
    const avgApiResponseSec =
        effectiveApiLatencies.length > 0
            ? Number((effectiveApiLatencies.reduce((a, b) => a + b, 0) / effectiveApiLatencies.length / 1000).toFixed(1))
            : null
    const avgApiResponseText = avgApiResponseSec === null ? 'N/A' : avgApiResponseSec.toFixed(1)
    const uiReadyAvgSec =
        METRICS.uiReadyTimes.length > 0
            ? Number((METRICS.uiReadyTimes.reduce((a, b) => a + b, 0) / METRICS.uiReadyTimes.length / 1000).toFixed(1))
            : null
    const uiReadyAvgText = uiReadyAvgSec === null ? 'N/A' : uiReadyAvgSec.toFixed(1)

    const chatCount = apiTrace.length
    const totalTokens = apiTrace.reduce((sum, entry) => sum + (entry.usageTotalTokens ?? 0), 0)
    const avgTokensPerChat = chatCount > 0 ? Math.round(totalTokens / chatCount) : null
    const aiRequests = apiTrace.reduce((sum, entry) => sum + (entry.aiRequestCount ?? entry.openaiRequestCount ?? 0), 0)
    const aiHttpAttempts = apiTrace.reduce((sum, entry) => sum + (entry.aiHttpAttempts ?? entry.openaiHttpAttempts ?? 0), 0)
    const parseRetryUsed = apiTrace.reduce((sum, entry) => sum + (entry.parseRetryAttempted ? 1 : 0), 0)
    const parseRetrySucceeded = apiTrace.reduce((sum, entry) => sum + (entry.parseRetrySucceeded ? 1 : 0), 0)
    const serverPolicyViolations = apiTrace.reduce((sum, entry) => sum + (entry.serverPolicyViolation ? 1 : 0), 0)
    const waitOver15sTurns = effectiveApiLatencies.filter(ms => ms >= 15_000).length
    const authConfigFailures = apiTrace.filter(entry => entry.failureClass === 'auth_config').length
    const runtimeQualityFailures = apiTrace.filter(entry => entry.failureClass === 'runtime_quality').length
    let policyMismatchFailures = apiTrace.filter(entry => entry.failureClass === 'policy_mismatch').length
    if (failureDiagnostics.some(msg => msg.includes('preflight') || msg.includes('meta.server mismatch'))) {
        policyMismatchFailures = Math.max(policyMismatchFailures, 1)
    }
    const otherFailures = apiTrace.filter(entry => entry.failureClass === 'other').length
    const failureSummaryLabel = status === 'PASS'
        ? 'none'
        : `auth=${authConfigFailures}, runtime=${runtimeQualityFailures}, policy=${policyMismatchFailures}, other=${otherFailures}`

    // 評価スコア算出 (簡易ロジック)
    let score = 'A'
    if (METRICS.errors > 0 || !METRICS.navigationSuccess) score = 'C'
    else if (METRICS.turns > 8 || Number(duration) > 180) score = 'B'
    if (status !== 'PASS') score = 'D'

    const apiTraceRows = apiTrace.length > 0
        ? apiTrace.map(entry => {
            const baseNote = entry.error
                ? `${entry.error}${entry.details ? ` details=${entry.details}` : ''}`
                : entry.url
            const shapeNote = entry.payloadKeys
                ? ` keys=${entry.payloadKeys} replyType=${entry.replyType ?? '-'} replyLen=${entry.replyLen ?? '-'} retryAfter=${entry.retryAfterSec ?? '-'}s`
                : ''
            const note = `${baseNote}${shapeNote}`
            const parseRetryLabel = entry.parseRetryAttempted
                ? (entry.parseRetrySucceeded ? 'attempted:yes (ok)' : 'attempted:yes (failed)')
                : '-'
            const serverMetaLabel = entry.serverPolicyVersion
                ? `policy=${entry.serverPolicyVersion} provider=${entry.serverAiProvider ?? '-'} format=${entry.serverResponseFormat ?? '-'} parseRecovery=${entry.serverParseRecoveryEnabled ?? '-'} retry=${entry.serverAiRetryCount ?? entry.serverOpenaiRetryCount ?? '-'} maxTokens=${entry.serverMaxTokens ?? '-'} profile=${entry.serverProfileName ?? '-'} profileRetry=${entry.serverProfileRetryCount ?? '-'} profileMaxTokens=${entry.serverProfileMaxTokens ?? '-'} softTimeout=${entry.serverProfileSoftTimeoutMs ?? '-'} hardTimeout=${entry.serverProfileHardTimeoutMs ?? '-'}${entry.serverPolicyViolation ? ' mismatch' : ''}`
                : (entry.serverPolicyViolation ? 'missing mismatch' : '-')
            const failureClass = entry.status >= 400 || entry.serverPolicyViolation
                ? (entry.failureClass ?? classifyFailure(entry))
                : '-'
            return `| ${entry.time} | ${entry.method} | ${entry.status} | ${entry.code ?? '-'} | ${failureClass} | ${entry.requestId ?? '-'} | ${entry.latencyMs ?? '-'} | ${entry.usageTotalTokens ?? '-'} | ${entry.aiRequestCount ?? entry.openaiRequestCount ?? '-'} | ${entry.aiHttpAttempts ?? entry.openaiHttpAttempts ?? '-'} | ${parseRetryLabel} | ${escapeTableText(shortText(serverMetaLabel, 120))} | ${escapeTableText(shortText(note, 140))} |`
        }).join('\n')
        : '| - | - | - | - | - | - | - | - | - | - | - | - | - |'

    const failureRows = failureDiagnostics.length > 0
        ? failureDiagnostics.map(item => `- ${item}`).join('\n')
        : '- なし'

    const markdown = `
# Real-Cost KY Test Report (${mode})

- **作成日**: ${new Date().toISOString()}
- **作成者**: Codex＋GPT-5
- **Date**: ${new Date().toISOString()}
- **Result**: ${status === 'PASS' ? '✅ PASS' : '❌ FAIL'}
- **Score**: ${score}
- **Base URL**: ${METRICS.baseUrl || process.env.LIVE_BASE_URL || 'http://localhost:5173'}
- **Failure Summary**: ${escapeTableText(shortText(failureSummaryLabel, 200))}

## Metrics Dashboard
| Metric | Value | Target | Status |
|---|---|---|---|
| **Total Duration** | ${duration}s | < 120s | ${Number(duration) < 120 ? '🟢' : '🟡'} |
| **Avg API Response** | ${avgApiResponseText}s | < 5s | ${avgApiResponseSec !== null && avgApiResponseSec < 5 ? '🟢' : '🟡'} |
| **Avg UI Ready** | ${uiReadyAvgText}s | - | ℹ️ |
| **Conversation Turns** | ${METRICS.turns} | 3-5 | ${METRICS.turns <= 5 ? '🟢' : (METRICS.turns > 8 ? '🔴' : '🟡')} |
| **Errors (AI/System)** | ${METRICS.errors} | 0 | ${METRICS.errors === 0 ? '🟢' : '🔴'} |
| **Nav Success** | ${METRICS.navigationSuccess ? 'Yes' : 'No'} | Yes | ${METRICS.navigationSuccess ? '🟢' : '🔴'} |
| **Total Tokens** | ${totalTokens} | - | ℹ️ |
| **Avg Tokens / Chat** | ${avgTokensPerChat ?? 'N/A'} | - | ℹ️ |
| **AI Requests** | ${aiRequests} | - | ℹ️ |
| **AI HTTP Attempts** | ${aiHttpAttempts} | - | ℹ️ |
| **Parse Retry Used** | ${parseRetryUsed} | 0 | ${parseRetryUsed === 0 ? '🟢' : '🟡'} |
| **Parse Retry Succeeded** | ${parseRetrySucceeded} | - | ℹ️ |
| **Server Policy Violations** | ${serverPolicyViolations} | 0 | ${serverPolicyViolations === 0 ? '🟢' : '🔴'} |
| **Auth/Config Failures** | ${authConfigFailures} | 0 | ${authConfigFailures === 0 ? '🟢' : '🔴'} |
| **Runtime Quality Failures** | ${runtimeQualityFailures} | 0 | ${runtimeQualityFailures === 0 ? '🟢' : '🔴'} |
| **Policy Mismatch Failures** | ${policyMismatchFailures} | 0 | ${policyMismatchFailures === 0 ? '🟢' : '🔴'} |
| **Other Failures** | ${otherFailures} | 0 | ${otherFailures === 0 ? '🟢' : '🟡'} |
| **Retry Button Clicks** | ${METRICS.retryButtonClicks} | 0 | ${METRICS.retryButtonClicks === 0 ? '🟢' : '🟡'} |
| **Wait > 15s Turns** | ${waitOver15sTurns} | 0 | ${waitOver15sTurns === 0 ? '🟢' : '🟡'} |

## Conversation Log
| Time | Speaker | Message |
|---|---|---|
${conversationLog.map(log => `| ${log.time} | **${log.speaker}** | ${log.message.replace(/\n/g, '<br>').slice(0, 100)}${log.message.length > 100 ? '...' : ''} |`).join('\n')}

## API Trace (/api/chat)
| Time | Method | Status | Code | Failure Class | Request ID | Latency ms | Tokens | AI Req | HTTP Attempts | ParseRetry | ServerMeta | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
${apiTraceRows}

## Failure Diagnostics
${failureRows}

## Browser Console (warning/error)
${browserConsole.length > 0 ? browserConsole.slice(-50).map(line => `- ${escapeTableText(shortText(line, 240))}`).join('\n') : '- (none)'}

## Page Errors
${pageErrors.length > 0 ? pageErrors.slice(-20).map(line => `- ${escapeTableText(shortText(line, 240))}`).join('\n') : '- (none)'}

## Analysis
- **Flow Completeness**: ${METRICS.navigationSuccess ? 'Full flow completed' : 'Stopped mid-flow'}
- **AI Responsiveness**: API Trace latency (/api/chat) based KPI.
`
    fs.writeFileSync(reportPath, markdown)
    console.log(`Report generated: ${reportPath}`)
}

test.use({ viewport: { width: 1280, height: 720 } })

test('Real-Cost: Full KY Scenario with Reporting', async ({ page }) => {
    // LIVEは再試行や待機が重なるため、タイムアウトを広めに確保する。
    test.setTimeout(SCENARIO_TIMEOUT_MS)
    resetRunState()
    METRICS.startTime = Date.now()

    page.on('console', (msg) => {
        const type = msg.type()
        if (type === 'error' || type === 'warning') {
            const loc = msg.location()
            const hasLocation = Boolean(loc.url)
            const locationSuffix = hasLocation
                ? ` @ ${loc.url}${typeof loc.lineNumber === 'number' ? `:${loc.lineNumber}` : ''}`
                : ''
            browserConsole.push(`[${type}] ${msg.text()}${locationSuffix}`)
        }
    })

    page.on('pageerror', (err) => {
        pageErrors.push(err.message)
    })

    page.on('request', (request: PWRequest) => {
        if (request.url().includes('/api/chat')) {
            requestStartTimes.set(request, Date.now())

            // Capture auth header shape once (avoid leaking token).
            if (!authHeaderObserved) {
                authHeaderObserved = true
                const headers = request.headers()
                const auth = headers['authorization']
                if (!auth) {
                    addFailureDiagnostic('Request Authorization header: (none)')
                    return
                }
                const lower = auth.toLowerCase()
                if (!lower.startsWith('bearer ')) {
                    addFailureDiagnostic(`Request Authorization header: present (non-bearer, len=${auth.length})`)
                    return
                }
                const token = auth.slice('bearer '.length)
                const isHex64 = /^[a-f0-9]{64}$/i.test(token)
                addFailureDiagnostic(`Request Authorization token: len=${token.length} hex64=${isHex64}`)
            }
        }
    })

    page.on('response', async (response: Response) => {
        await recordApiTrace(response)
        const status = response.status()
        const url = response.url()
        if (status >= 400 && url.includes('/api/metrics')) {
            addFailureDiagnostic(`metrics API failure status=${status} url=${url}`)
        }
    })

    console.log(`--- STARTING TEST (Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}) ---`)
    await recordLog('System', `Test Started: 溶接作業シナリオ (Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'})`)

    // LIVEはトークンをバンドルへ埋め込まず、必要時のみ実行環境から注入する。
    if (RUN_LIVE) {
        const token = LIVE_API_TOKEN
        if (!token) {
            addFailureDiagnostic(
                'LIVE preflight guard: VITE_API_TOKEN/API_TOKEN が未解決です。`npm run test:cost:preflight` 実行後に再度お試しください。'
            )
        } else {
            if (LIVE_API_TOKEN_INFO.source === 'devvars') {
                console.log('LIVE token source: .dev.vars(API_TOKEN) -> VITE_API_TOKEN')
            }
            await page.addInitScript(({ key, value }) => {
                try {
                    window.localStorage.setItem(key, value)
                } catch {
                    // ignore
                }
            }, { key: API_TOKEN_STORAGE_KEY, value: token })
        }
    }

    // Dry Run モック設定
    if (DRY_RUN) {
        let turnCount = 0
        let successTurn = 0
        let injectedFailure = false
        await page.route('**/api/chat', async route => {
            turnCount++
            const mockResponses = [
                { reply: "はい、承知しました。" }, // Turn 0
                {
                    reply: "溶接作業ですね。どのような危険が予想されますか？",
                    extracted: { workDescription: "配管の溶接作業" }
                },
                {
                    reply: "火花による引火の危険ですね。「何が原因で」起こると思いますか？",
                    extracted: { hazardDescription: "火花が飛散して周囲の可燃物に引火する恐れ" }
                },
                {
                    reply: "なるほど。危険度は5ですね。まず設備・環境での対策を1つ教えてください。",
                    extracted: {
                        whyDangerous: ["周囲に養生が不十分なため"],
                        riskLevel: 5
                    }
                },
                 {
                     reply: "対策ありがとうございます。これで【1件目】はOKです。次に【2件目】の想定される危険を教えてください。",
                     extracted: {
                        countermeasures: [
                            { category: 'equipment', text: "消火器をすぐに使える位置に配置" },
                            { category: 'equipment', text: "スパッタシートで隙間なく養生" },
                            { category: 'ppe', text: "防炎手袋を着用する" },
                        ],
                         nextAction: 'ask_more_work' // Commit trigger (危険1件目)
                     }
                 },
                {
                    reply: "行動目標を記録しました。完了画面に移動します。",
                    extracted: {
                        actionGoal: "火気使用時の完全養生よし！",
                        nextAction: 'confirm'
                    },
                    needsWrapUp: true
                }
            ]

            // E2E要件: 自動テストでは「リトライ」ボタンを押して再実行できることを確認する。
            // そのため、最初のリクエストだけ意図的に失敗させる（次回は同じターンの正常応答を返す）。
            if (!injectedFailure) {
                injectedFailure = true
                await route.fulfill({
                    status: 503,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        error: 'AIサービスが混雑しています',
                        code: 'AI_UPSTREAM_ERROR',
                        retriable: true,
                    }),
                })
                console.log(`[Mock API] Injected failure on turn ${turnCount}`)
                return
            }

            // 単純なシーケンス応答（失敗リクエストはsuccessTurnに含めない）
            const index = Math.min(successTurn + 1, mockResponses.length - 1)
            const response = mockResponses[index]
            successTurn++
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify(response)
            })
            console.log(`[Mock API] Responded to turn ${turnCount} (Index ${index})`)
        })
    }

    try {
        if (RUN_LIVE && !LIVE_PREFLIGHT_PASSED) {
            const guardMessage =
                'LIVE preflight guard: LIVE_PREFLIGHT_PASSED=1 が未設定です。`npm run test:cost:live` で事前疎通チェックを通してから実行してください。'
            addFailureDiagnostic(guardMessage)
            throw new Error(guardMessage)
        }
        if (RUN_LIVE && !LIVE_API_TOKEN) {
            const guardMessage =
                'LIVE preflight guard: VITE_API_TOKEN/API_TOKEN が未解決です。`npm run test:cost:preflight` を通してから実行してください。'
            addFailureDiagnostic(guardMessage)
            throw new Error(guardMessage)
        }

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
        }).toPass({ timeout: CHAT_WAIT_TIMEOUT_MS })

        const endWait = Date.now()
        METRICS.uiReadyTimes.push(endWait - startWait)

        // 最新のAI応答を取得
        const initialBubble = assistantBubbles.last()
        const initialText = await initialBubble.textContent() || ''
        await recordLog('AI', initialText)

        const sendButton = page.getByTestId('button-send-message')
        let userTurn = 0

        // Helper: ユーザー入力とAI応答待ち
        async function sendUserMessage(text: string, expectedResponsePart?: string): Promise<string> {
            userTurn++
            try {
                assertNoFatalInfraError()
                await expect(chatInput).toBeVisible({ timeout: 15000 })
                await chatInput.fill(text)
                await expect(sendButton).toBeEnabled() // 送信ボタンが有効になるのを待つ
                await sendButton.click()
                await recordLog('User', text)

                const retryButton = page.getByTestId('button-retry')
                const MAX_MANUAL_RETRIES_PER_TURN = 5
                const computeRetryDelayMs = (attemptIndex: number): number => {
                    const lastFailure = [...apiTrace].reverse().find((e) => e.status >= 400 && e.retriable)
                    if (lastFailure?.retryAfterSec && Number.isFinite(lastFailure.retryAfterSec)) {
                        return Math.min(30, lastFailure.retryAfterSec) * 1000
                    }
                    return Math.min(10_000, 1000 * (attemptIndex + 1))
                }

                const waitForCompletion = async () => {
                    const startWait = Date.now()
                    const countBefore = await assistantBubbles.count()
                    const thinking = page.locator('text=考え中...').first()
                    const completionHeading = page.locator('text=KY活動完了').first()
                    const safetyChecklistPanel = page.getByTestId('safety-checklist-panel')
                    const deadline = Date.now() + CHAT_WAIT_TIMEOUT_MS

                    while (Date.now() < deadline) {
                        assertNoFatalInfraError()
                        const onCompletePage = page.url().includes('/complete') || await completionHeading.isVisible().catch(() => false)
                        if (onCompletePage) {
                            METRICS.uiReadyTimes.push(Date.now() - startWait)
                            return
                        }
                        const countAfter = await assistantBubbles.count()
                        if (countAfter > countBefore) {
                            METRICS.uiReadyTimes.push(Date.now() - startWait)
                            return
                        }
                        const onSafetyChecklist = await safetyChecklistPanel.isVisible().catch(() => false)
                        if (onSafetyChecklist) {
                            METRICS.uiReadyTimes.push(Date.now() - startWait)
                            return
                        }

                        const isThinkingVisible = await thinking.isVisible().catch(() => false)
                        const isInputEnabled = await chatInput.isEnabled().catch(() => false)
                        // 返答バブルが「追加」されない実装でも、thinkingが消えて入力が戻れば完了扱いとする。
                        if (!isThinkingVisible && isInputEnabled) {
                            METRICS.uiReadyTimes.push(Date.now() - startWait)
                            return
                        }

                        await page.waitForTimeout(200)
                    }

                    throw new Error(`AI response timeout (${CHAT_WAIT_TIMEOUT_MS}ms)`)
                }

                // まずは通常の応答待ち
                await waitForCompletion()
                assertNoFatalInfraError()

                // エラーが出た場合は「リトライ」ボタンを押して再実行（回数を記録）
                for (let attempt = 0; attempt < MAX_MANUAL_RETRIES_PER_TURN; attempt++) {
                    const retryVisible = await retryButton.isVisible().catch(() => false)
                    if (!retryVisible) break

                    const retryEnabled = await retryButton.isEnabled().catch(() => false)
                    if (!retryEnabled) {
                        addFailureDiagnostic(`Retry button visible but disabled (Turn ${userTurn}).`)
                        break
                    }

                    // Capture the visible error message (helps distinguish chat errors vs validation errors).
                    const errorText = await retryButton
                        .locator('xpath=..')
                        .locator('span')
                        .first()
                        .textContent()
                        .catch(() => null)
                    if (errorText) {
                        addFailureDiagnostic(`Retry visible with error="${shortText(errorText, 120)}" (Turn ${userTurn}, attempt ${attempt + 1}).`)
                    }

                    // Respect Retry-After (when available) to avoid hammering the live API.
                    const delayMs = computeRetryDelayMs(attempt)
                    if (delayMs > 0) {
                        await page.waitForTimeout(delayMs)
                    }

                    METRICS.retryButtonClicks++
                    await retryButton.click()
                    await recordLog('User', '(Clicked Retry Button)')

                    await waitForCompletion()
                    assertNoFatalInfraError()
                }

                // まだリトライが見えるなら、回復できていないので失敗として扱う
                if (await retryButton.isVisible().catch(() => false)) {
                    const errorText = await retryButton
                        .locator('xpath=..')
                        .locator('span')
                        .first()
                        .textContent()
                        .catch(() => null)
                    if (errorText) {
                        addFailureDiagnostic(`Retry still visible with error="${shortText(errorText, 160)}" (Turn ${userTurn}).`)
                    }
                    addFailureDiagnostic(`Retry button still visible after ${MAX_MANUAL_RETRIES_PER_TURN} retries (Turn ${userTurn}).`)
                    throw new Error('retry did not recover')
                }

                if (expectedResponsePart) {
                    // Note: 画面上の固定ラベル（例: KYボードの見出し）とAIメッセージ内の文言が一致して
                    // text= が複数要素にマッチすることがあるため、厳格一致（strict mode）を避けて
                    // 「どれか1つが可視」になったことを確認する。
                    const candidate = page.locator(`text=${expectedResponsePart}`)
                    const deadline = Date.now() + CHAT_WAIT_TIMEOUT_MS
                    let found = false
                    while (Date.now() < deadline) {
                        assertNoFatalInfraError()
                        const count = await candidate.count().catch(() => 0)
                        for (let i = 0; i < count; i++) {
                            const visible = await candidate.nth(i).isVisible().catch(() => false)
                            if (visible) {
                                found = true
                                break
                            }
                        }
                        if (found) break
                        await page.waitForTimeout(200)
                    }
                    if (!found) {
                        throw new Error(`expected response part not found: ${expectedResponsePart}`)
                    }
                    await recordLog('AI', `(Verified presence of: ${expectedResponsePart})`)
                }

                // 完了画面へ自動遷移した場合はチャットバブルが消えるため、取得をスキップする。
                const onCompletePageNow =
                    page.url().includes('/complete') ||
                    await page.locator('text=KY活動完了').first().isVisible().catch(() => false)
                if (!onCompletePageNow) {
                    const bubbleCount = await assistantBubbles.count().catch(() => 0)
                    if (bubbleCount > 0) {
                        const latestBubble = assistantBubbles.last()
                        const textContent = await latestBubble.textContent().catch(() => null) || ''
                        await recordLog('AI', textContent)
                        return textContent
                    }
                }
                return ''
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error)
                addFailureDiagnostic(`Turn ${userTurn} failed. User="${shortText(text, 40)}" reason="${shortText(message, 180)}"`)
                throw error
            }
        }

        async function completeSafetyChecklistIfVisible(): Promise<boolean> {
            const checklistPanel = page.getByTestId('safety-checklist-panel')
            const completionHeading = page.locator('text=KY活動完了').first()
            const waitDeadline = Date.now() + 15000

            while (Date.now() < waitDeadline) {
                assertNoFatalInfraError()
                const onCompletePage = page.url().includes('/complete') || await completionHeading.isVisible().catch(() => false)
                if (onCompletePage) return false

                const visible = await checklistPanel.isVisible().catch(() => false)
                if (visible) break
                await page.waitForTimeout(200)
            }

            const isVisibleNow = await checklistPanel.isVisible().catch(() => false)
            if (!isVisibleNow) return false

            const checkKeys = [
                'pointAndCall',
                'toolAndWireInspection',
                'ppeReady',
                'evacuationRouteAndContact',
            ] as const

            for (const key of checkKeys) {
                const checkbox = page.getByTestId(`safety-check-${key}`)
                await expect(checkbox).toBeVisible({ timeout: 5000 })
                const pressed = await checkbox.getAttribute('aria-pressed')
                if (pressed !== 'true') {
                    await checkbox.click()
                    await recordLog('User', `(Checked ${key})`)
                }
            }

            const completeButton = page.getByTestId('button-complete-safety-checks')
            await expect(completeButton).toBeEnabled({ timeout: 5000 })
            await completeButton.click()
            await recordLog('User', '(Clicked 安全確認完了)')
            return true
        }

        let completionArrived = false

        // シナリオ開始
        // Dry Runの時は期待値を指定して安定化
        if (DRY_RUN) {
            await sendUserMessage('配管の溶接作業を行います', '溶接作業ですね')
            await sendUserMessage('火花が飛散して周囲の可燃物に引火する危険があります', '火花による引火')
            await sendUserMessage('周囲に養生が不十分なためです。危険度は一番高い5です', '設備・環境')
            await sendUserMessage('設備・環境: 消火器をすぐに使える位置に配置し、スパッタシートで隙間なく養生します。人配置・行動: 火気監視を1人つけます。')

            // 現行仕様: 1件目は「1件目完了」ボタン押下でのみ確定する。
            const completeFirstWorkItemButton = page.getByTestId('button-complete-first-work-item')
            await expect(completeFirstWorkItemButton).toBeVisible({ timeout: 15000 })
            await expect(completeFirstWorkItemButton).toBeEnabled({ timeout: 15000 })
            await completeFirstWorkItemButton.click()
            await recordLog('User', '(Clicked 1件目完了)')

            // 1件目が保存されていること（作業・危険の件数）が増えることで検証
            await expect(page.locator('text=/作業・危険 \\(1件\\)/').first()).toBeVisible({ timeout: 15000 })

            // 2件目の途中でも「KY完了」で行動目標へスキップできる（APIは呼ばれない）
            await sendUserMessage('KY完了', '今日の行動目標')
            await sendUserMessage('ありません。行動目標は「火気使用時の完全養生よし！」にします。これで内容を確定して終了してください。', '行動目標を記録しました')
        } else {
            // --- 1件目: 危険内容（何をするとき / 何が原因で / どうなる） ---
            const firstHazardReply = await sendUserMessage('配管の溶接作業をするとき、周囲の養生が不十分で火花が飛散し、可燃物に引火する恐れがあります')

            // 危険度選択UIが出る場合はそれを使い、出ない場合はテキストで送る
            let selectedRisk = false
            const normalizedFirstReply = firstHazardReply
                .normalize('NFKC')
                .replace(/\s+/g, '')
                .toLowerCase()
            const asksRiskLevelByText =
                normalizedFirstReply.includes('危険度') ||
                normalizedFirstReply.includes('リスク') ||
                normalizedFirstReply.includes('1から5') ||
                normalizedFirstReply.includes('1〜5') ||
                normalizedFirstReply.includes('1~5') ||
                normalizedFirstReply.includes('5段階')
            const risk5Button = page.locator('button').filter({ hasText: '重大' }).first()
            const riskUiAlreadyVisible = await risk5Button.isVisible().catch(() => false)

            if (asksRiskLevelByText || riskUiAlreadyVisible) {
                try {
                    await expect(risk5Button).toBeVisible({ timeout: 8000 })
                    await expect(risk5Button).toBeEnabled({ timeout: 8000 })

                    const countBefore = await assistantBubbles.count()
                    const startWait = Date.now()
                    await risk5Button.click()
                    await recordLog('User', '(Selected Risk Level: 5)')

                    await expect(async () => {
                        const countAfter = await assistantBubbles.count()
                        expect(countAfter).toBeGreaterThan(countBefore)
                    }).toPass({ timeout: CHAT_WAIT_TIMEOUT_MS })

                    const endWait = Date.now()
                    METRICS.uiReadyTimes.push(endWait - startWait)
                    const riskReply = await assistantBubbles.last().textContent() || ''
                    await recordLog('AI', riskReply)
                    selectedRisk = true
                } catch {
                    selectedRisk = false
                }
            }

            if (!selectedRisk) {
                await sendUserMessage('危険度は5です')
            }

            // --- 対策（合計2件以上） ---
            await sendUserMessage('対策は、設備・環境: 消火器を作業地点のすぐそばに設置し、スパッタシートで周囲の可燃物を隙間なく覆って養生します。人配置・行動: 火気監視を1人つけます。')

            // 追加深掘りが来た場合の1回だけ補足
            const afterMeasures = await assistantBubbles.last().textContent().catch(() => '') || ''
            if (afterMeasures.includes('どのよう') || afterMeasures.includes('どこ') || afterMeasures.includes('具体的')) {
                await sendUserMessage('消火器はすぐ手が届く位置に置き、スパッタシートは火花が飛ぶ範囲を床と周囲の可燃物に固定して隙間が出ないようにします。')
            }

            // 完了確認（AIが「これでOK？」を聞く想定）
            const inputVisibleBeforeConfirm = await chatInput.isVisible().catch(() => false)
            if (inputVisibleBeforeConfirm) {
                await sendUserMessage('これでOKです。他にありません。')
            } else {
                completionArrived = await Promise.race([
                    page.waitForURL('**/complete', { timeout: 10000 }).then(() => true).catch(() => false),
                    page.locator('text=KY活動完了').waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false),
                ])
            }

            // 2件目の途中でも打ち切り可能（2件目は破棄して行動目標へ）。
            // 実運用では保存件数の反映遅延があるため、件数コミット待ちは行わず
            // 「KY完了」ショートカット→未遷移時は行動目標入力へフォールバックする。
            if (!completionArrived) {
                const inputVisibleBeforeShortcut = await chatInput.isVisible().catch(() => false)
                if (inputVisibleBeforeShortcut) {
                    await sendUserMessage('KY完了')
                    // KY完了ショートカット後は、完了遷移の有無を短時間だけ確認し、
                    // 未遷移なら即行動目標入力へ進めて無駄な30秒待機を避ける。
                    const completedByShortcut = await Promise.race([
                        page.waitForURL('**/complete', { timeout: 5000 }).then(() => true).catch(() => false),
                        page.locator('text=KY活動完了').waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false),
                    ])
                    if (completedByShortcut) {
                        completionArrived = true
                        await recordLog('System', 'Navigated to Complete page (auto after KY完了)')
                        METRICS.navigationSuccess = true
                    } else {
                        await sendUserMessage('行動目標は「火気使用時の完全養生よし！」です。これで内容を確定して終了してください。')
                    }
                }
            }
        }

        // 4. 完了画面への遷移待ち
        const tryWaitForCompletionPage = async (timeoutMs: number): Promise<boolean> => {
            try {
                await Promise.race([
                    page.waitForURL('**/complete', { timeout: timeoutMs }),
                    page.locator('text=KY活動完了').waitFor({ state: 'visible', timeout: timeoutMs }),
                ])
                return true
            } catch {
                return false
            }
        }

        if (!completionArrived) {
            const completedSafetyChecklist = await completeSafetyChecklistIfVisible()
            if (completedSafetyChecklist) {
                completionArrived = await tryWaitForCompletionPage(30000)
            }
        }

        if (!completionArrived) {
            completionArrived = await tryWaitForCompletionPage(15000)
        }
        if (completionArrived && !METRICS.navigationSuccess) {
            await recordLog('System', 'Navigated to Complete page (auto)')
            METRICS.navigationSuccess = true
        }

        if (!completionArrived) {
            let transitioned = await tryWaitForCompletionPage(30000)
            if (!transitioned && !DRY_RUN) {
                const inputVisible = await chatInput.isVisible().catch(() => false)
                if (inputVisible) {
                    await sendUserMessage('行動目標は「火気使用時の完全養生よし！」です。')
                    transitioned = await tryWaitForCompletionPage(30000)
                } else {
                    const completedSafetyChecklist = await completeSafetyChecklistIfVisible()
                    transitioned = completedSafetyChecklist
                        ? await tryWaitForCompletionPage(30000)
                        : await tryWaitForCompletionPage(10000)
                }
            }
            if (!transitioned && !DRY_RUN) {
                const inputVisible = await chatInput.isVisible().catch(() => false)
                if (inputVisible) {
                    await sendUserMessage('はい、これで確定して終了してください。')
                    transitioned = await tryWaitForCompletionPage(30000)
                } else {
                    const completedSafetyChecklist = await completeSafetyChecklistIfVisible()
                    transitioned = completedSafetyChecklist
                        ? await tryWaitForCompletionPage(30000)
                        : await tryWaitForCompletionPage(10000)
                }
            }
            if (!transitioned) {
                const progressText = await page.locator('text=/作業・危険 \\(\\d+件\\)/').first().textContent().catch(() => null)
                addFailureDiagnostic(`completion page did not appear. progress=${progressText ?? 'unknown'}`)
                throw new Error('completion page did not appear')
            }

            completionArrived = true
            if (!METRICS.navigationSuccess) {
                await recordLog('System', 'Navigated to Complete page (auto)')
                METRICS.navigationSuccess = true
            }
        }

        // --- Phase 2.6 Evolution: Verify Feedback Features ---
        // フィードバックカードの出現待ち（API応答次第で表示されない場合もある）
        console.log('Checking for Feedback Cards...')
        try {
            const feedbackSection = page.locator('text=KYフィードバック').first()
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
