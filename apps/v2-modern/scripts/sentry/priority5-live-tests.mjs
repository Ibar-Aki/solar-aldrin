#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { chromium } from '@playwright/test'

const execFileAsync = promisify(execFile)

const cfg = {
    sentryBaseUrl: (process.env.SENTRY_API_BASE_URL || 'https://sentry.io').replace(/\/+$/, ''),
    sentryAuthToken: process.env.SENTRY_AUTH_TOKEN?.trim() || '',
    org: process.env.SENTRY_ORG_SLUG?.trim() || '',
    project: process.env.SENTRY_PROJECT_SLUG?.trim() || '',
    appUrl: (process.env.SENTRY_TEST_APP_URL || process.env.LIVE_BASE_URL || '').trim(),
    apiUrl: (process.env.SENTRY_TEST_API_URL || process.env.LIVE_API_BASE_URL || '').trim(),
    apiToken: (process.env.SENTRY_TEST_API_TOKEN || process.env.VITE_API_TOKEN || '').trim(),
    sentryTestEndpointToken: (process.env.SENTRY_TEST_ENDPOINT_TOKEN || '').trim(),
    expectedEnvironment: process.env.SENTRY_TEST_EXPECTED_ENV?.trim() || '',
    expectedRelease: process.env.SENTRY_TEST_EXPECTED_RELEASE?.trim() || '',
    releaseCurrent: process.env.SENTRY_TEST_RELEASE_CURRENT?.trim() || '',
    releaseBaseline: process.env.SENTRY_TEST_RELEASE_BASELINE?.trim() || '',
    releaseRegressionTolerance: Number(process.env.SENTRY_TEST_RELEASE_COMPARE_TOLERANCE || '0'),
    strictAlertsCheck: process.env.SENTRY_TEST_ALERTS_STRICT === '1',
    issueAlertRulesPathTemplate: process.env.SENTRY_TEST_ISSUE_RULES_PATH || '/api/0/projects/{org}/{project}/rules/',
    metricAlertRulesPathTemplate: process.env.SENTRY_TEST_METRIC_RULES_PATH || '/api/0/organizations/{org}/alert-rules/',
    incidentsPathTemplate: process.env.SENTRY_TEST_INCIDENTS_PATH || '/api/0/organizations/{org}/incidents/',
    releasePathTemplate: process.env.SENTRY_TEST_RELEASE_PATH || '/api/0/organizations/{org}/releases/{release}/',
}

const state = {
    frontendEventId: null,
    frontendRelease: null,
    backendRelease: null,
    frontendIssueId: null,
    backendIssueId: null,
}

const failures = []
const warnings = []

function nowIso() {
    return new Date().toISOString()
}

function makeRunId() {
    const rand = Math.random().toString(36).slice(2, 8)
    const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
    return `codex-sentry-p5-${ts}-${rand}`
}

function ensureRequired() {
    const missing = []
    if (!cfg.sentryAuthToken) missing.push('SENTRY_AUTH_TOKEN')
    if (!cfg.org) missing.push('SENTRY_ORG_SLUG')
    if (!cfg.project) missing.push('SENTRY_PROJECT_SLUG')
    if (!cfg.appUrl) missing.push('SENTRY_TEST_APP_URL (or LIVE_BASE_URL)')
    if (!cfg.apiUrl) missing.push('SENTRY_TEST_API_URL (or LIVE_API_BASE_URL)')
    if (missing.length > 0) {
        throw new Error(`必須環境変数が不足しています: ${missing.join(', ')}`)
    }
}

function logStep(title) {
    console.log(`\n[${nowIso()}] ${title}`)
}

function warn(message) {
    warnings.push(message)
    console.warn(`WARN: ${message}`)
}

function fail(testName, error) {
    const message = error instanceof Error ? error.message : String(error)
    failures.push({ testName, message })
    console.error(`FAIL: ${testName}\n  ${message}`)
}

function pass(testName, detail) {
    console.log(`PASS: ${testName}${detail ? ` - ${detail}` : ''}`)
}

function renderPathTemplate(template, vars) {
    return template
        .replaceAll('{org}', encodeURIComponent(vars.org))
        .replaceAll('{project}', encodeURIComponent(vars.project))
        .replaceAll('{release}', encodeURIComponent(vars.release || ''))
}

async function sentryApi(path, init = {}) {
    const isAbsolute = /^https?:\/\//i.test(path)
    const url = isAbsolute ? path : `${cfg.sentryBaseUrl}${path.startsWith('/') ? path : `/${path}`}`
    const headers = new Headers(init.headers || {})
    headers.set('Authorization', `Bearer ${cfg.sentryAuthToken}`)
    headers.set('Content-Type', 'application/json')
    headers.set('Accept', 'application/json')

    const response = await fetch(url, {
        ...init,
        headers,
    })

    const raw = await response.text()
    let json = null
    try {
        json = raw ? JSON.parse(raw) : null
    } catch {
        json = null
    }

    if (!response.ok) {
        const detail = raw ? raw.slice(0, 500) : '(empty)'
        const error = new Error(`Sentry API ${response.status} ${response.statusText}: ${url} :: ${detail}`)
        error.responseStatus = response.status
        throw error
    }

    return json
}

function asArray(value) {
    if (Array.isArray(value)) return value
    if (value && Array.isArray(value.data)) return value.data
    return []
}

function eventTag(event, key) {
    if (!event) return null
    if (typeof event[key] === 'string' && event[key]) return event[key]

    const tags = Array.isArray(event.tags) ? event.tags : []
    for (const tag of tags) {
        if (Array.isArray(tag) && tag[0] === key) return String(tag[1])
        if (tag && typeof tag === 'object' && tag.key === key) return String(tag.value ?? '')
    }
    return null
}

function eventIdOf(event) {
    return event?.eventID || event?.id || eventTag(event, 'event_id') || null
}

function eventTraceId(event) {
    return (
        event?.contexts?.trace?.trace_id ||
        event?.context?.trace?.trace_id ||
        eventTag(event, 'trace')
    )
}

async function sleep(ms) {
    await new Promise(resolve => setTimeout(resolve, ms))
}

async function poll({ label, timeoutMs = 120000, intervalMs = 3000, action }) {
    const started = Date.now()
    let lastError = null
    while (Date.now() - started < timeoutMs) {
        try {
            const value = await action()
            if (value) return value
        } catch (error) {
            lastError = error
        }
        await sleep(intervalMs)
    }
    if (lastError) {
        throw new Error(`${label} のポーリングがタイムアウトしました。lastError=${lastError.message}`)
    }
    throw new Error(`${label} のポーリングがタイムアウトしました。`)
}

async function listIssues(query) {
    const path = `/api/0/projects/${encodeURIComponent(cfg.org)}/${encodeURIComponent(cfg.project)}/issues/?query=${encodeURIComponent(query)}&sort=date&limit=20`
    const issues = await sentryApi(path)
    return asArray(issues)
}

async function findIssueByMarker(marker) {
    return poll({
        label: `Issue検索(${marker})`,
        action: async () => {
            const issues = await listIssues(marker)
            return issues.find((issue) => {
                const title = String(issue.title || '')
                const culprit = String(issue.culprit || '')
                return title.includes(marker) || culprit.includes(marker)
            }) || null
        },
    })
}

async function fetchLatestIssueEvent(issueId) {
    try {
        return await sentryApi(`/api/0/issues/${encodeURIComponent(issueId)}/events/latest/`)
    } catch (error) {
        const list = await sentryApi(`/api/0/issues/${encodeURIComponent(issueId)}/events/?limit=1`)
        return asArray(list)[0] || null
    }
}

function assertEventHasEnvAndRelease(event, expectedEnvironment, expectedRelease) {
    const actualEnvironment = eventTag(event, 'environment')
    const actualRelease = event?.release?.version || event?.release || eventTag(event, 'release')
    if (!actualEnvironment) {
        throw new Error('event に environment が付与されていません。')
    }
    if (!actualRelease) {
        throw new Error('event に release が付与されていません。')
    }
    if (expectedEnvironment && actualEnvironment !== expectedEnvironment) {
        throw new Error(`environment 不一致: expected=${expectedEnvironment} actual=${actualEnvironment}`)
    }
    if (expectedRelease && String(actualRelease) !== expectedRelease) {
        throw new Error(`release 不一致: expected=${expectedRelease} actual=${String(actualRelease)}`)
    }
    return { actualEnvironment, actualRelease: String(actualRelease) }
}

async function triggerFrontendException(marker, runId) {
    const browser = await chromium.launch({ headless: true })
    try {
        const context = await browser.newContext()
        const page = await context.newPage()
        await page.goto(cfg.appUrl, { waitUntil: 'domcontentloaded' })
        await page.waitForFunction(() => typeof window.__sentryTestCaptureException === 'function', { timeout: 15000 })
        const eventId = await page.evaluate(({ message, testId }) => {
            const fn = window.__sentryTestCaptureException
            if (typeof fn !== 'function') throw new Error('window.__sentryTestCaptureException が未定義です。VITE_ENABLE_SENTRY_TEST_HOOK=1 を設定してください。')
            return fn(message, {
                sentry_test_id: testId,
                sentry_test_case: 'priority1_frontend_smoke',
            })
        }, { message: marker, testId: runId })
        await page.waitForTimeout(1500)
        await context.close()
        return typeof eventId === 'string' ? eventId : null
    } finally {
        await browser.close()
    }
}

async function runFrontendTraceProbe(runId) {
    const browser = await chromium.launch({ headless: true })
    try {
        const context = await browser.newContext()
        const page = await context.newPage()
        await page.goto(cfg.appUrl, { waitUntil: 'domcontentloaded' })
        await page.waitForFunction(() => typeof window.__sentryTestRunTraceProbe === 'function', { timeout: 15000 })
        const result = await page.evaluate(async ({ apiBaseUrl, testId }) => {
            const fn = window.__sentryTestRunTraceProbe
            if (typeof fn !== 'function') throw new Error('window.__sentryTestRunTraceProbe が未定義です。VITE_ENABLE_SENTRY_TEST_HOOK=1 を設定してください。')
            return fn({
                apiBaseUrl,
                testId,
                workMs: 180,
            })
        }, {
            apiBaseUrl: cfg.apiUrl,
            testId: runId,
        })
        await context.close()
        return result
    } finally {
        await browser.close()
    }
}

async function triggerBackendException(marker, runId, extraHeaders = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...extraHeaders,
    }
    if (cfg.apiToken) headers.Authorization = `Bearer ${cfg.apiToken}`
    if (cfg.sentryTestEndpointToken) headers['x-sentry-test-token'] = cfg.sentryTestEndpointToken

    const response = await fetch(`${cfg.apiUrl.replace(/\/+$/, '')}/api/debug/sentry-test-error`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            message: marker,
            testId: runId,
        }),
    })

    if (response.status !== 500) {
        const body = await response.text().catch(() => '')
        throw new Error(`バックエンド例外発火APIが想定外ステータスです: status=${response.status} body=${body.slice(0, 300)}`)
    }
}

function parseTraceIdFromTraceHeader(header) {
    if (!header) return null
    const traceId = header.split('-')[0]
    return /^[0-9a-f]{32}$/i.test(traceId) ? traceId.toLowerCase() : null
}

function findNumberDeep(value, keys) {
    if (!value || typeof value !== 'object') return null
    const queue = [value]
    const keySet = new Set(keys.map((k) => k.toLowerCase()))
    while (queue.length > 0) {
        const current = queue.shift()
        if (!current || typeof current !== 'object') continue
        for (const [k, v] of Object.entries(current)) {
            const key = k.toLowerCase()
            if (keySet.has(key) && typeof v === 'number' && Number.isFinite(v)) {
                return v
            }
            if (v && typeof v === 'object') {
                queue.push(v)
            }
        }
    }
    return null
}

async function runSourcemapsExplain(eventId) {
    const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx'
    const args = [
        '-y',
        '@sentry/cli',
        'sourcemaps',
        'explain',
        eventId,
        '--org',
        cfg.org,
        '--project',
        cfg.project,
    ]
    const { stdout, stderr } = await execFileAsync(npxBin, args, {
        env: {
            ...process.env,
            SENTRY_AUTH_TOKEN: cfg.sentryAuthToken,
        },
        maxBuffer: 1024 * 1024 * 8,
    })
    return `${stdout}\n${stderr}`
}

function assertSourcemapExplainOutput(output, eventId) {
    const normalized = String(output || '')
    const explicitFailurePatterns = [
        /no (uploaded )?sourcemaps? (found|available)/i,
        /unable to (find|resolve|locate).*(sourcemap|debug file|artifact)/i,
        /missing (debug file|artifact|source map)/i,
        /event.*not found/i,
    ]

    for (const pattern of explicitFailurePatterns) {
        if (pattern.test(normalized)) {
            const excerpt = normalized.slice(0, 800)
            throw new Error(
                `sentry-cli sourcemaps explain が失敗を示しています。eventId=${eventId}\n${excerpt}`
            )
        }
    }

    if (!/sourcemap|source map|debug id|artifact/i.test(normalized)) {
        warn('sentry-cli の出力に sourcemap 関連キーワードが見当たりませんでした。出力全文を確認してください。')
    }
}

async function test1Smoke(runId) {
    const frontendMarker = `[sentry-test][frontend][${runId}] intentional frontend exception`
    const backendMarker = `[sentry-test][backend][${runId}] intentional backend exception`

    const frontendHintEventId = await triggerFrontendException(frontendMarker, runId)
    await triggerBackendException(backendMarker, runId)

    const frontendIssue = await findIssueByMarker(frontendMarker)
    const backendIssue = await findIssueByMarker(backendMarker)

    state.frontendIssueId = String(frontendIssue.id)
    state.backendIssueId = String(backendIssue.id)

    const frontendEvent = await fetchLatestIssueEvent(state.frontendIssueId)
    const backendEvent = await fetchLatestIssueEvent(state.backendIssueId)

    const feMeta = assertEventHasEnvAndRelease(frontendEvent, cfg.expectedEnvironment, cfg.expectedRelease)
    const beMeta = assertEventHasEnvAndRelease(backendEvent, cfg.expectedEnvironment, cfg.expectedRelease)

    state.frontendEventId = eventIdOf(frontendEvent) || frontendHintEventId
    state.frontendRelease = feMeta.actualRelease
    state.backendRelease = beMeta.actualRelease

    if (!state.frontendEventId) {
        throw new Error('フロントエンド eventId を取得できませんでした。')
    }
}

async function test2SourcemapRestore() {
    if (!state.frontendEventId) {
        throw new Error('Test1 で frontend eventId が取得できていないため続行できません。')
    }
    const output = await runSourcemapsExplain(state.frontendEventId)
    assertSourcemapExplainOutput(output, state.frontendEventId)
}

async function test3Alerts(runId) {
    const issueRulesPath = renderPathTemplate(cfg.issueAlertRulesPathTemplate, cfg)
    const metricRulesPath = renderPathTemplate(cfg.metricAlertRulesPathTemplate, cfg)

    const issueRulesRaw = await sentryApi(issueRulesPath)
    const issueRules = asArray(issueRulesRaw)
    if (issueRules.length === 0) {
        throw new Error(`Issue Alert ルールが0件です。path=${issueRulesPath}`)
    }

    let metricRules = []
    try {
        const metricRulesRaw = await sentryApi(metricRulesPath)
        metricRules = asArray(metricRulesRaw)
        if (metricRules.length === 0) {
            throw new Error(`Metric Alert ルールが0件です。path=${metricRulesPath}`)
        }
    } catch (error) {
        if (cfg.strictAlertsCheck) throw error
        warn(`Metric Alert 取得をスキップしました（path=${metricRulesPath}）。必要なら SENTRY_TEST_METRIC_RULES_PATH を環境に合わせて設定してください。`)
    }

    // ルールのシグナルとなるエラーを複数回発生させる
    const marker = `[sentry-test][alert][${runId}] intentional alert signal`
    for (let i = 0; i < 4; i++) {
        await triggerBackendException(marker, `${runId}-alert`)
        await sleep(350)
    }
    await findIssueByMarker(marker)

    // 任意: incident endpoint から発報状態を確認
    try {
        const incidentsPath = renderPathTemplate(cfg.incidentsPathTemplate, cfg)
        const incidents = asArray(await sentryApi(`${incidentsPath}?limit=20`))
        if (incidents.length === 0) {
            warn('Incident一覧が0件です。通知経路（Slack/メール）はSentry UI上で確認してください。')
        }
    } catch (error) {
        if (cfg.strictAlertsCheck) throw error
        warn('Incident API の確認をスキップしました。通知の到達確認は Sentry UI で実施してください。')
    }

    if (metricRules.length === 0) {
        warn('Metric Alert の動作確認はルール取得不可のため部分実施です。')
    }
}

async function test4DistributedTrace(runId) {
    const probe = await runFrontendTraceProbe(runId)
    if (!probe || probe.status !== 200) {
        throw new Error(`フロントのトレースプローブに失敗しました。status=${probe?.status}`)
    }

    const sentTrace = probe.sentryTraceSent
    const recvTrace = probe.sentryTraceReceived
    const rootTraceId = parseTraceIdFromTraceHeader(sentTrace)
    const recvRootTraceId = parseTraceIdFromTraceHeader(recvTrace)
    if (!rootTraceId) {
        throw new Error('フロント側 sentry-trace ヘッダの trace_id を取得できません。')
    }
    if (recvTrace && recvRootTraceId !== rootTraceId) {
        throw new Error(`トレース伝播ヘッダが不一致です。sent=${rootTraceId} recv=${recvRootTraceId}`)
    }

    const marker = `[sentry-test][trace][${runId}] backend error with propagated trace`
    const extraHeaders = {
        'sentry-trace': sentTrace,
    }
    if (probe.baggageSent) {
        extraHeaders.baggage = probe.baggageSent
    }
    await triggerBackendException(marker, `${runId}-trace`, extraHeaders)

    const issue = await findIssueByMarker(marker)
    const event = await fetchLatestIssueEvent(String(issue.id))
    const eventTrace = eventTraceId(event)
    if (!eventTrace) {
        throw new Error('Sentry event から trace_id を取得できません。SENTRY_TRACES_SAMPLE_RATE と VITE_SENTRY_TRACES_SAMPLE_RATE を確認してください。')
    }
    if (String(eventTrace).toLowerCase() !== rootTraceId) {
        throw new Error(`trace_id 不一致: expected=${rootTraceId} actual=${String(eventTrace).toLowerCase()}`)
    }
}

async function fetchReleaseDetails(releaseVersion) {
    const releasePath = renderPathTemplate(cfg.releasePathTemplate, {
        ...cfg,
        release: releaseVersion,
    })
    return sentryApi(releasePath)
}

async function test5ReleaseHealth() {
    const currentRelease = cfg.releaseCurrent || state.backendRelease || state.frontendRelease
    if (!currentRelease) {
        throw new Error('current release を決定できません。SENTRY_TEST_RELEASE_CURRENT を指定してください。')
    }

    const current = await fetchReleaseDetails(currentRelease)
    const currentCrashFreeRate = findNumberDeep(current, ['crashFreeRate', 'crash_free_rate'])
    if (currentCrashFreeRate === null) {
        throw new Error(`release=${currentRelease} の crashFreeRate を取得できません。Release Health のセッション収集設定を確認してください。`)
    }

    if (cfg.releaseBaseline) {
        const baseline = await fetchReleaseDetails(cfg.releaseBaseline)
        const baselineCrashFreeRate = findNumberDeep(baseline, ['crashFreeRate', 'crash_free_rate'])
        if (baselineCrashFreeRate === null) {
            throw new Error(`baseline release=${cfg.releaseBaseline} の crashFreeRate を取得できません。`)
        }
        const lowerBound = baselineCrashFreeRate - cfg.releaseRegressionTolerance
        if (currentCrashFreeRate < lowerBound) {
            throw new Error(
                `Release Health 回帰を検知: current=${currentCrashFreeRate.toFixed(3)} baseline=${baselineCrashFreeRate.toFixed(3)} tolerance=${cfg.releaseRegressionTolerance.toFixed(3)}`
            )
        }
    } else {
        warn('SENTRY_TEST_RELEASE_BASELINE 未指定のため、回帰比較はスキップしました。')
    }
}

async function run() {
    ensureRequired()
    const runId = makeRunId()

    console.log('=== Sentry Priority Top5 Live Tests ===')
    console.log(`runId=${runId}`)
    console.log(`org=${cfg.org} project=${cfg.project}`)
    console.log(`appUrl=${cfg.appUrl}`)
    console.log(`apiUrl=${cfg.apiUrl}`)

    const tests = [
        { name: 'T1 Error Collection Smoke (frontend/backend)', fn: () => test1Smoke(runId) },
        { name: 'T2 Sourcemap Restore (sentry-cli explain)', fn: () => test2SourcemapRestore() },
        { name: 'T3 Alert Behavior (Issue + Metric)', fn: () => test3Alerts(runId) },
        { name: 'T4 Distributed Trace Propagation', fn: () => test4DistributedTrace(runId) },
        { name: 'T5 Release Health Regression Check', fn: () => test5ReleaseHealth() },
    ]

    for (const testCase of tests) {
        logStep(testCase.name)
        try {
            await testCase.fn()
            pass(testCase.name)
        } catch (error) {
            fail(testCase.name, error)
        }
    }

    console.log('\n=== Summary ===')
    if (failures.length === 0) {
        console.log('All tests passed.')
    } else {
        console.log(`Failed: ${failures.length}`)
        for (const f of failures) {
            console.log(`- ${f.testName}: ${f.message}`)
        }
    }

    if (warnings.length > 0) {
        console.log(`Warnings: ${warnings.length}`)
        for (const warningMessage of warnings) {
            console.log(`- ${warningMessage}`)
        }
    }

    process.exitCode = failures.length > 0 ? 1 : 0
}

run().catch((error) => {
    console.error(`Fatal: ${error instanceof Error ? error.stack || error.message : String(error)}`)
    process.exit(1)
})
