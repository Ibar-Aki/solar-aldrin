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

function formatRate(count, total) {
    if (!total) return '0.0% (0/0)'
    const rate = (count / total) * 100
    return `${rate.toFixed(1)}% (${count}/${total})`
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

    const avgResponse = parseSeconds(metrics['Avg AI Response'])
    const errors = parseInteger(metrics['Errors (AI/System)'])
    const navSuccess = (metrics['Nav Success'] || '').trim().toLowerCase()
    const navFailed = navSuccess.startsWith('no')
    const failed = result === 'FAIL'
    const needsRetry = failed || navFailed || errors > 0

    return {
        filePath,
        dayKey,
        result,
        avgResponse,
        errors,
        navFailed,
        needsRetry,
        mode: detectMode(filePath),
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
| 応答時間 P50 | ${formatSeconds(p50)} | Avg AI Response を使用 |
| 応答時間 P95 | ${formatSeconds(p95)} | Avg AI Response を使用 |
| エラー率 | ${formatRate(stats.errorCount, stats.total)} | Errors (AI/System) > 0 |
| 再試行率 | ${formatRate(stats.retryCount, stats.total)} | Result=FAIL または Nav Success=No または Errors>0 |

## 内訳

- モード別: DRY-RUN ${stats.modeCounts['DRY-RUN'] || 0} / LIVE ${stats.modeCounts['LIVE'] || 0} / TEST ${stats.modeCounts['TEST'] || 0} / UNKNOWN ${stats.modeCounts['UNKNOWN'] || 0}
- 結果別: PASS ${stats.resultCounts.PASS || 0} / FAIL ${stats.resultCounts.FAIL || 0} / UNKNOWN ${stats.resultCounts.UNKNOWN || 0}

## 元データ

- ${stats.files.length} files from reports/real-cost/**
`
}

function main() {
    ensureDir(outputDir)

    const files = listMarkdownFiles(sourceDir)
    const grouped = {}

    for (const filePath of files) {
        const report = parseReport(filePath)
        if (!report) continue

        if (!grouped[report.dayKey]) {
            grouped[report.dayKey] = {
                total: 0,
                responses: [],
                errorCount: 0,
                retryCount: 0,
                modeCounts: {},
                resultCounts: {},
                files: [],
            }
        }

        const bucket = grouped[report.dayKey]
        bucket.total += 1
        if (typeof report.avgResponse === 'number') {
            bucket.responses.push(report.avgResponse)
        }
        if (report.errors > 0) {
            bucket.errorCount += 1
        }
        if (report.needsRetry) {
            bucket.retryCount += 1
        }
        bucket.modeCounts[report.mode] = (bucket.modeCounts[report.mode] || 0) + 1
        bucket.resultCounts[report.result] = (bucket.resultCounts[report.result] || 0) + 1
        bucket.files.push(report.filePath)
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

- **応答時間 P50/P95**: 各レポートの \`Avg AI Response\` を集計対象として算出。P50/P95 は **Nearest Rank** 方式
- **エラー率**: \`Errors (AI/System)\` が 1 以上のレポート比率
- **再試行率**: \`Result=FAIL\` または \`Nav Success=No\` または \`Errors>0\` の比率

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
