import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const sourceDir = path.join(rootDir, 'reports', 'real-cost')
const outputDir = path.join(rootDir, 'reports', 'perf')

const pad2 = (value) => String(value).padStart(2, '0')

const now = new Date()
const nowDate = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
const nowDateTime = `${nowDate} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`

function ensureDir(target) {
    fs.mkdirSync(target, { recursive: true })
}

function listMarkdownFiles(dir) {
    if (!fs.existsSync(dir)) return []
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    const results = []
    for (const entry of entries) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            results.push(...listMarkdownFiles(full))
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
            results.push(full)
        }
    }
    return results
}

function parseSeconds(value) {
    if (!value) return null
    const num = parseFloat(value.replace(/[^0-9.]/g, ''))
    return Number.isFinite(num) ? num : null
}

function parseInteger(value) {
    if (!value) return 0
    const num = parseInt(value.replace(/[^0-9-]/g, ''), 10)
    return Number.isFinite(num) ? num : 0
}

function parseOptionalInteger(value) {
    if (!value) return null
    const num = parseInt(value.replace(/[^0-9-]/g, ''), 10)
    return Number.isFinite(num) ? num : null
}

function percentile(values, p) {
    if (!values.length) return null
    const sorted = [...values].sort((a, b) => a - b)
    const rank = Math.ceil(p * sorted.length)
    const index = Math.min(sorted.length - 1, Math.max(0, rank - 1))
    return sorted[index]
}

function formatSeconds(value) {
    if (value === null || value === undefined) return '-'
    return `${value.toFixed(1)}s`
}

function formatInt(value) {
    if (value === null || value === undefined) return '-'
    return `${Math.round(value)}`
}

function formatRate(count, total) {
    if (!total) return '0.0% (0/0)'
    const rate = (count / total) * 100
    return `${rate.toFixed(1)}% (${count}/${total})`
}

function formatSecondsForBucket(value, total) {
    if (!total) return 'N/A'
    return formatSeconds(value)
}

function formatRateForBucket(count, total) {
    if (!total) return 'N/A'
    return formatRate(count, total)
}

function detectMode(filePath) {
    const upper = filePath.toUpperCase()
    if (upper.includes('DRY-RUN')) return 'DRY-RUN'
    if (upper.includes(`${path.sep}LIVE${path.sep}`) || upper.includes('LIVE-')) return 'LIVE'
    if (upper.includes(`${path.sep}TEST${path.sep}`) || upper.includes('-TEST-')) return 'TEST'
    return 'UNKNOWN'
}

function parseReport(filePath) {
    const content = fs.readFileSync(filePath, 'utf8')
    const dateMatch = content.match(/^\- \*\*Date\*\*: (.+)$/m)
    if (!dateMatch) return null

    const dateStr = dateMatch[1].trim()
    const dayKey = dateStr.slice(0, 10)

    const resultMatch = content.match(/^\- \*\*Result\*\*: .*?(PASS|FAIL)\b/m)
    const result = resultMatch ? resultMatch[1].toUpperCase() : 'UNKNOWN'

    const metrics = {}
    const rowRegex = /^\|\s*\*\*(.+?)\*\*\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*$/gm
    let row
    while ((row = rowRegex.exec(content)) !== null) {
        metrics[row[1].trim()] = row[2].trim()
    }

    const totalDuration = parseSeconds(metrics['Total Duration'])
    const avgResponse = parseSeconds(metrics['Avg AI Response'])
    const errors = parseInteger(metrics['Errors (AI/System)'])
    const navSuccess = (metrics['Nav Success'] || '').trim().toLowerCase()
    const navFailed = navSuccess.startsWith('no')
    const failed = result === 'FAIL'
    const needsRetry = failed || navFailed || errors > 0

    const totalTokens = parseOptionalInteger(metrics['Total Tokens'])
    const avgTokensPerChat = parseOptionalInteger(metrics['Avg Tokens / Chat'])
    const openaiRequests = parseOptionalInteger(metrics['OpenAI Requests'])
    const openaiHttpAttempts = parseOptionalInteger(metrics['OpenAI HTTP Attempts'])
    const parseRetryUsed = parseOptionalInteger(metrics['Parse Retry Used'])
    const parseRetrySucceeded = parseOptionalInteger(metrics['Parse Retry Succeeded'])
    const retryButtonClicks = parseOptionalInteger(metrics['Retry Button Clicks'])
    const waitOver15sTurns = parseOptionalInteger(metrics['Wait > 15s Turns'])

    return {
        filePath,
        dayKey,
        result,
        totalDuration,
        avgResponse,
        errors,
        navFailed,
        needsRetry,
        mode: detectMode(filePath),
        totalTokens,
        avgTokensPerChat,
        openaiRequests,
        openaiHttpAttempts,
        parseRetryUsed,
        parseRetrySucceeded,
        retryButtonClicks,
        waitOver15sTurns,
    }
}

function readExistingMeta(filePath) {
    if (!fs.existsSync(filePath)) return null
    const content = fs.readFileSync(filePath, 'utf8')
    const createdMatch = content.match(/^\*\*作成日\*\*: (.+)$/m)
    const authorMatch = content.match(/^\*\*作成者\*\*: (.+)$/m)
    return {
        createdAt: createdMatch ? createdMatch[1].trim() : null,
        author: authorMatch ? authorMatch[1].trim() : null,
    }
}

function buildSummary(dayKey, stats, existingMeta) {
    const createdAt = existingMeta?.createdAt || nowDateTime
    const author = existingMeta?.author || 'Codex＋GPT-5'
    const p50 = percentile(stats.responses, 0.5)
    const p95 = percentile(stats.responses, 0.95)
    const durationP50 = percentile(stats.durations, 0.5)
    const durationP95 = percentile(stats.durations, 0.95)
    const tokensP50 = percentile(stats.tokens, 0.5)
    const tokensP95 = percentile(stats.tokens, 0.95)
    const avgTokensP50 = percentile(stats.avgTokensPerChat, 0.5)
    const avgTokensP95 = percentile(stats.avgTokensPerChat, 0.95)
    const httpAttemptsP50 = percentile(stats.openaiHttpAttempts, 0.5)
    const httpAttemptsP95 = percentile(stats.openaiHttpAttempts, 0.95)
    const liveP50 = percentile(stats.live.responses, 0.5)
    const liveP95 = percentile(stats.live.responses, 0.95)
    const liveDurationP50 = percentile(stats.live.durations, 0.5)
    const liveDurationP95 = percentile(stats.live.durations, 0.95)
    const liveTokensP50 = percentile(stats.live.tokens, 0.5)
    const liveTokensP95 = percentile(stats.live.tokens, 0.95)
    const liveAvgTokensP50 = percentile(stats.live.avgTokensPerChat, 0.5)
    const liveAvgTokensP95 = percentile(stats.live.avgTokensPerChat, 0.95)
    const liveHttpAttemptsP50 = percentile(stats.live.openaiHttpAttempts, 0.5)
    const liveHttpAttemptsP95 = percentile(stats.live.openaiHttpAttempts, 0.95)

    return `# 日次性能サマリ (${dayKey})

**対象日**: ${dayKey}  
**集計対象**: reports/real-cost/**  
**作成日**: ${createdAt}  
**作成者**: ${author}  
**更新日**: ${nowDate}

---

## サマリ

| 指標 | 値 | 備考 |
|---|---|---|
| レポート件数 | ${stats.total} |  |
| 総所要時間 P50 | ${formatSeconds(durationP50)} | Total Duration を使用 |
| 総所要時間 P95 | ${formatSeconds(durationP95)} | Total Duration を使用 |
| 応答時間 P50 | ${formatSeconds(p50)} | Avg AI Response を使用 |
| 応答時間 P95 | ${formatSeconds(p95)} | Avg AI Response を使用 |
| 総トークン P50 | ${formatInt(tokensP50)} | Total Tokens を使用 |
| 総トークン P95 | ${formatInt(tokensP95)} | Total Tokens を使用 |
| トークン/チャット P50 | ${formatInt(avgTokensP50)} | Avg Tokens / Chat を使用 |
| トークン/チャット P95 | ${formatInt(avgTokensP95)} | Avg Tokens / Chat を使用 |
| OpenAI HTTP Attempts P50 | ${formatInt(httpAttemptsP50)} | OpenAI HTTP Attempts を使用 |
| OpenAI HTTP Attempts P95 | ${formatInt(httpAttemptsP95)} | OpenAI HTTP Attempts を使用 |
| エラー率 | ${formatRate(stats.errorCount, stats.total)} | Errors (AI/System) > 0 |
| 再試行率 | ${formatRate(stats.retryCount, stats.total)} | Result=FAIL または Nav Success=No または Errors>0 |
| JSONパース再試行率 | ${formatRate(stats.parseRetryReportCount, stats.total)} | Parse Retry Used > 0 |
| リトライ押下率 | ${formatRate(stats.retryButtonReportCount, stats.total)} | Retry Button Clicks > 0 |
| リトライ押下合計 | ${stats.retryButtonClicksTotal} | Retry Button Clicks の合計 |
| 待機>15s発生率 | ${formatRate(stats.waitOver15sReportCount, stats.total)} | Wait > 15s Turns > 0 |
| 待機>15s合計ターン | ${stats.waitOver15sTurnsTotal} | Wait > 15s Turns の合計 |

## LIVEのみサマリ

| 指標 | 値 | 備考 |
|---|---|---|
| レポート件数 | ${stats.live.total} |  |
| 総所要時間 P50 | ${formatSecondsForBucket(liveDurationP50, stats.live.total)} | Total Duration を使用 |
| 総所要時間 P95 | ${formatSecondsForBucket(liveDurationP95, stats.live.total)} | Total Duration を使用 |
| 応答時間 P50 | ${formatSecondsForBucket(liveP50, stats.live.total)} | Avg AI Response を使用 |
| 応答時間 P95 | ${formatSecondsForBucket(liveP95, stats.live.total)} | Avg AI Response を使用 |
| 総トークン P50 | ${formatInt(liveTokensP50)} | Total Tokens を使用 |
| 総トークン P95 | ${formatInt(liveTokensP95)} | Total Tokens を使用 |
| トークン/チャット P50 | ${formatInt(liveAvgTokensP50)} | Avg Tokens / Chat を使用 |
| トークン/チャット P95 | ${formatInt(liveAvgTokensP95)} | Avg Tokens / Chat を使用 |
| OpenAI HTTP Attempts P50 | ${formatInt(liveHttpAttemptsP50)} | OpenAI HTTP Attempts を使用 |
| OpenAI HTTP Attempts P95 | ${formatInt(liveHttpAttemptsP95)} | OpenAI HTTP Attempts を使用 |
| エラー率 | ${formatRateForBucket(stats.live.errorCount, stats.live.total)} | Errors (AI/System) > 0 |
| 再試行率 | ${formatRateForBucket(stats.live.retryCount, stats.live.total)} | Result=FAIL または Nav Success=No または Errors>0 |
| JSONパース再試行率 | ${formatRateForBucket(stats.live.parseRetryReportCount, stats.live.total)} | Parse Retry Used > 0 |
| リトライ押下率 | ${formatRateForBucket(stats.live.retryButtonReportCount, stats.live.total)} | Retry Button Clicks > 0 |
| リトライ押下合計 | ${stats.live.retryButtonClicksTotal} | Retry Button Clicks の合計 |
| 待機>15s発生率 | ${formatRateForBucket(stats.live.waitOver15sReportCount, stats.live.total)} | Wait > 15s Turns > 0 |
| 待機>15s合計ターン | ${stats.live.waitOver15sTurnsTotal} | Wait > 15s Turns の合計 |

## 内訳

- モード別: DRY-RUN ${stats.modeCounts['DRY-RUN'] || 0} / LIVE ${stats.modeCounts['LIVE'] || 0} / TEST ${stats.modeCounts['TEST'] || 0} / UNKNOWN ${stats.modeCounts['UNKNOWN'] || 0}
- 結果別: PASS ${stats.resultCounts.PASS || 0} / FAIL ${stats.resultCounts.FAIL || 0} / UNKNOWN ${stats.resultCounts.UNKNOWN || 0}

## 元データ

- ${stats.files.length} files from reports/real-cost/**
`
}

function main() {
    ensureDir(outputDir)

    const files = listMarkdownFiles(sourceDir).filter(filePath =>
        path.basename(filePath).toLowerCase().startsWith('real-cost-')
    )
    const grouped = {}

    for (const filePath of files) {
        const report = parseReport(filePath)
        if (!report) continue

        if (!grouped[report.dayKey]) {
            grouped[report.dayKey] = {
                total: 0,
                responses: [],
                durations: [],
                tokens: [],
                avgTokensPerChat: [],
                openaiHttpAttempts: [],
                errorCount: 0,
                retryCount: 0,
                parseRetryReportCount: 0,
                retryButtonReportCount: 0,
                retryButtonClicksTotal: 0,
                waitOver15sReportCount: 0,
                waitOver15sTurnsTotal: 0,
                modeCounts: {},
                resultCounts: {},
                files: [],
                live: {
                    total: 0,
                    responses: [],
                    durations: [],
                    tokens: [],
                    avgTokensPerChat: [],
                    openaiHttpAttempts: [],
                    errorCount: 0,
                    retryCount: 0,
                    parseRetryReportCount: 0,
                    retryButtonReportCount: 0,
                    retryButtonClicksTotal: 0,
                    waitOver15sReportCount: 0,
                    waitOver15sTurnsTotal: 0,
                },
            }
        }

        const bucket = grouped[report.dayKey]
        bucket.total += 1
        if (typeof report.totalDuration === 'number') {
            bucket.durations.push(report.totalDuration)
        }
        if (typeof report.avgResponse === 'number') {
            bucket.responses.push(report.avgResponse)
        }
        if (typeof report.totalTokens === 'number') {
            bucket.tokens.push(report.totalTokens)
        }
        if (typeof report.avgTokensPerChat === 'number') {
            bucket.avgTokensPerChat.push(report.avgTokensPerChat)
        }
        if (typeof report.openaiHttpAttempts === 'number') {
            bucket.openaiHttpAttempts.push(report.openaiHttpAttempts)
        }
        if (report.errors > 0) {
            bucket.errorCount += 1
        }
        if (report.needsRetry) {
            bucket.retryCount += 1
        }
        if ((report.parseRetryUsed ?? 0) > 0) {
            bucket.parseRetryReportCount += 1
        }
        if ((report.retryButtonClicks ?? 0) > 0) {
            bucket.retryButtonReportCount += 1
            bucket.retryButtonClicksTotal += report.retryButtonClicks ?? 0
        }
        if ((report.waitOver15sTurns ?? 0) > 0) {
            bucket.waitOver15sReportCount += 1
            bucket.waitOver15sTurnsTotal += report.waitOver15sTurns ?? 0
        }
        bucket.modeCounts[report.mode] = (bucket.modeCounts[report.mode] || 0) + 1
        bucket.resultCounts[report.result] = (bucket.resultCounts[report.result] || 0) + 1
        bucket.files.push(report.filePath)

        if (report.mode === 'LIVE') {
            bucket.live.total += 1
            if (typeof report.totalDuration === 'number') {
                bucket.live.durations.push(report.totalDuration)
            }
            if (typeof report.avgResponse === 'number') {
                bucket.live.responses.push(report.avgResponse)
            }
            if (typeof report.totalTokens === 'number') {
                bucket.live.tokens.push(report.totalTokens)
            }
            if (typeof report.avgTokensPerChat === 'number') {
                bucket.live.avgTokensPerChat.push(report.avgTokensPerChat)
            }
            if (typeof report.openaiHttpAttempts === 'number') {
                bucket.live.openaiHttpAttempts.push(report.openaiHttpAttempts)
            }
            if (report.errors > 0) {
                bucket.live.errorCount += 1
            }
            if (report.needsRetry) {
                bucket.live.retryCount += 1
            }
            if ((report.parseRetryUsed ?? 0) > 0) {
                bucket.live.parseRetryReportCount += 1
            }
            if ((report.retryButtonClicks ?? 0) > 0) {
                bucket.live.retryButtonReportCount += 1
                bucket.live.retryButtonClicksTotal += report.retryButtonClicks ?? 0
            }
            if ((report.waitOver15sTurns ?? 0) > 0) {
                bucket.live.waitOver15sReportCount += 1
                bucket.live.waitOver15sTurnsTotal += report.waitOver15sTurns ?? 0
            }
        }
    }

    const dayKeys = Object.keys(grouped).sort()
    for (const dayKey of dayKeys) {
        const outPath = path.join(outputDir, `daily-summary-${dayKey}.md`)
        const existingMeta = readExistingMeta(outPath)
        const content = buildSummary(dayKey, grouped[dayKey], existingMeta)
        fs.writeFileSync(outPath, content, 'utf8')
    }

    const readmePath = path.join(outputDir, 'README.md')
    const existingMeta = readExistingMeta(readmePath)
    const createdAt = existingMeta?.createdAt || nowDateTime
    const author = existingMeta?.author || 'Codex＋GPT-5'

    const readmeContent = `# 性能指標サマリ（日次）

**目的**: プロンプト/コンテクスト調整の前後で体感指標を比較できるようにする  
**作成日**: ${createdAt}  
**作成者**: ${author}  
**更新日**: ${nowDate}

---

## 対象データ

- \`reports/real-cost/**\` の Markdown レポート
- 日付は \`Date\` 行（ISO形式）から日単位（YYYY-MM-DD）で集計

---

## 指標の定義

- **総所要時間 P50/P95**: 各レポートの \`Total Duration\` を集計対象として算出。P50/P95 は **Nearest Rank** 方式
- **応答時間 P50/P95**: 各レポートの \`Avg AI Response\` を集計対象として算出。P50/P95 は **Nearest Rank** 方式
- **総トークン P50/P95**: 各レポートの \`Total Tokens\` を集計対象として算出。P50/P95 は **Nearest Rank** 方式
- **トークン/チャット P50/P95**: 各レポートの \`Avg Tokens / Chat\` を集計対象として算出。P50/P95 は **Nearest Rank** 方式
- **OpenAI HTTP Attempts P50/P95**: 各レポートの \`OpenAI HTTP Attempts\` を集計対象として算出。P50/P95 は **Nearest Rank** 方式
- **エラー率**: \`Errors (AI/System)\` が 1 以上のレポート比率
- **再試行率**: \`Result=FAIL\` または \`Nav Success=No\` または \`Errors>0\` の比率
- **JSONパース再試行率**: \`Parse Retry Used\` が 1 以上のレポート比率
- **リトライ押下率**: \`Retry Button Clicks\` が 1 以上のレポート比率
- **待機>15s発生率**: \`Wait > 15s Turns\` が 1 以上のレポート比率

---

## 出力

- \`reports/perf/daily-summary-YYYY-MM-DD.md\`

---

## 使い方

~~~bash
node scripts/generate_perf_summary.mjs
~~~

---

## 補足

- DRY-RUN は API 呼び出しを行わないため、\`Avg AI Response\` が 0.0s になりやすい
- 指標の定義や閾値は運用に合わせて調整可能
`

    fs.writeFileSync(readmePath, readmeContent, 'utf8')

    console.log(`Generated ${dayKeys.length} daily summary files in ${outputDir}`)
}

main()
