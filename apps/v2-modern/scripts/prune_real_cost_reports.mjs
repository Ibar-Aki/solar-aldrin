import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const reportRoot = path.join(rootDir, 'reports', 'real-cost')

const pad2 = (v) => String(v).padStart(2, '0')
const now = new Date()
const nowDate = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
const nowDateTime = `${nowDate} ${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`

function listFiles(dir) {
    if (!fs.existsSync(dir)) return []
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    const results = []
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            results.push(...listFiles(fullPath))
        } else if (entry.isFile()) {
            results.push(fullPath)
        }
    }
    return results
}

function getMode(filePath) {
    const rel = path.relative(reportRoot, filePath)
    const parts = rel.split(path.sep)
    if (parts.length < 2) return 'UNKNOWN'
    return parts[0]
}

function parseDateFromContent(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8')
        const match = content.match(/^\- \*\*Date\*\*: (.+)$/m)
        if (!match) return null
        const parsed = new Date(match[1].trim())
        return Number.isNaN(parsed.getTime()) ? null : parsed
    } catch {
        return null
    }
}

function normalizeDay(date) {
    return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
}

function readMeta(existingContent) {
    const createdAt = existingContent.match(/^\- 作成日時: (.+)$/m)?.[1]?.trim()
    const author = existingContent.match(/^\- 作成者: (.+)$/m)?.[1]?.trim()
    return {
        createdAt: createdAt || nowDateTime,
        author: author || 'Codex＋GPT-5',
    }
}

function main() {
    if (!fs.existsSync(reportRoot)) {
        console.log(`Report root not found: ${reportRoot}`)
        return
    }

    const allFiles = listFiles(reportRoot)
    const candidates = allFiles.filter((filePath) => {
        if (!filePath.toLowerCase().endsWith('.md')) return false
        const base = path.basename(filePath)
        if (!base.startsWith('real-cost-')) return false
        return true
    })

    const buckets = new Map()
    for (const filePath of candidates) {
        const mode = getMode(filePath)
        const stats = fs.statSync(filePath)
        const dateObj = parseDateFromContent(filePath) || stats.mtime
        const dayKey = normalizeDay(dateObj)
        const bucketKey = `${mode}::${dayKey}`
        if (!buckets.has(bucketKey)) {
            buckets.set(bucketKey, [])
        }
        buckets.get(bucketKey).push({
            filePath,
            mode,
            dayKey,
            timestamp: dateObj.getTime(),
        })
    }

    const deleted = []
    const kept = []

    for (const entries of buckets.values()) {
        entries.sort((a, b) => b.timestamp - a.timestamp)
        kept.push(entries[0])
        for (const extra of entries.slice(1)) {
            fs.unlinkSync(extra.filePath)
            deleted.push(extra)
        }
    }

    const logPath = path.join(reportRoot, `prune-log-${nowDate}.md`)
    const existingContent = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : ''
    const meta = readMeta(existingContent)

    const runLog = [
        `## 実行記録 ${nowDateTime}`,
        '',
        `- 対象ファイル数: ${candidates.length}`,
        `- 残した件数: ${kept.length}`,
        `- 削除件数: ${deleted.length}`,
        '',
        '### ルール',
        '- mode(LIVE/DRY-RUN/test) + 日付(UTC) ごとに最新1件を保持',
        '',
        '### 保持ファイル',
        ...kept
            .sort((a, b) => a.mode.localeCompare(b.mode) || a.dayKey.localeCompare(b.dayKey))
            .map((item) => `- ${item.mode} ${item.dayKey}: \`${path.relative(rootDir, item.filePath)}\``),
        '',
        '### 削除ファイル',
        ...(deleted.length > 0
            ? deleted
                .sort((a, b) => a.mode.localeCompare(b.mode) || a.dayKey.localeCompare(b.dayKey))
                .map((item) => `- ${item.mode} ${item.dayKey}: \`${path.relative(rootDir, item.filePath)}\``)
            : ['- なし']),
        '',
    ].join('\n')

    const header = [
        '# Real-Cost レポート整理ログ',
        '',
        `- 作成日時: ${meta.createdAt}`,
        `- 作成者: ${meta.author}`,
        `- 更新日: ${nowDate}`,
        '',
        '---',
        '',
    ].join('\n')

    const nextContent = existingContent
        ? existingContent.replace(/^\- 更新日: .+$/m, `- 更新日: ${nowDate}`) + '\n' + runLog
        : header + runLog

    fs.writeFileSync(logPath, nextContent, 'utf8')

    console.log(`Kept ${kept.length} files, deleted ${deleted.length} files.`)
    console.log(`Log: ${path.relative(rootDir, logPath)}`)
}

main()
