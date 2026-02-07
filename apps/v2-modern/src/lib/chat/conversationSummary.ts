import type { SoloKYSession, WorkItem } from '@/types/ky'

function normalizeLine(value: string): string {
    return value.replace(/\s+/g, ' ').trim()
}

function uniq<T>(values: T[]): T[] {
    return [...new Set(values)]
}

function formatCategories(countermeasures: WorkItem['countermeasures'] | undefined): string {
    if (!countermeasures || countermeasures.length === 0) return '未確認'
    const categories = uniq(countermeasures.map((cm) => cm.category))
    const labels: Record<string, string> = { ppe: '保護具', behavior: '行動', equipment: '設備・準備' }
    return categories.map((c) => labels[c] ?? String(c)).join(' / ')
}

function formatMeasures(countermeasures: WorkItem['countermeasures'] | undefined, maxItems: number): string {
    if (!countermeasures || countermeasures.length === 0) return ''
    const texts = countermeasures.map((cm) => normalizeLine(cm.text)).filter(Boolean)
    return texts.slice(0, maxItems).join(' / ')
}

export function buildConversationSummary(options: {
    session: SoloKYSession
    currentWorkItem: Partial<WorkItem>
    status: string
    maxLength?: number
}): string {
    const { session, currentWorkItem, status, maxLength = 1200 } = options

    const lines: string[] = []
    lines.push('【確認済み情報（要約）】')
    lines.push(`- 現場: ${normalizeLine(session.siteName)}`)
    lines.push(`- 作業者: ${normalizeLine(session.userName)}`)
    lines.push(`- 天候: ${normalizeLine(session.weather)}`)
    if (session.processPhase) lines.push(`- 工程: ${normalizeLine(session.processPhase)}`)
    if (session.healthCondition) lines.push(`- 体調: ${normalizeLine(session.healthCondition)}`)
    lines.push(`- 状態: ${normalizeLine(String(status))}`)

    if (session.workItems.length > 0) {
        lines.push('')
        lines.push('【完了済みの作業】')
        for (const [idx, item] of session.workItems.entries()) {
            const work = normalizeLine(item.workDescription)
            const hazard = normalizeLine(item.hazardDescription)
            const cats = formatCategories(item.countermeasures)
            lines.push(`- 作業${idx + 1}: 作業=${work} / 危険=${hazard} / 対策カテゴリ=${cats}`)
        }
    }

    const hasAnyCurrent =
        Boolean(currentWorkItem.workDescription) ||
        Boolean(currentWorkItem.hazardDescription) ||
        Boolean(currentWorkItem.whyDangerous?.length) ||
        Boolean(currentWorkItem.countermeasures?.length)

    if (hasAnyCurrent) {
        lines.push('')
        lines.push('【進行中の作業（入力途中）】')
        if (currentWorkItem.workDescription) lines.push(`- 作業内容: ${normalizeLine(currentWorkItem.workDescription)}`)
        if (currentWorkItem.hazardDescription) lines.push(`- 危険: ${normalizeLine(currentWorkItem.hazardDescription)}`)
        if (currentWorkItem.whyDangerous && currentWorkItem.whyDangerous.length > 0) {
            const why = currentWorkItem.whyDangerous.map((v) => normalizeLine(v)).filter(Boolean).slice(0, 5).join(' / ')
            if (why) lines.push(`- 要因: ${why}`)
        }
        if (currentWorkItem.countermeasures && currentWorkItem.countermeasures.length > 0) {
            lines.push(`- 対策カテゴリ: ${formatCategories(currentWorkItem.countermeasures)}`)
            const measures = formatMeasures(currentWorkItem.countermeasures, 6)
            if (measures) lines.push(`- 対策: ${measures}`)
        }
    }

    // Hard cap
    const summary = lines.join('\n').trim()
    return summary.length <= maxLength ? summary : summary.slice(0, maxLength)
}

