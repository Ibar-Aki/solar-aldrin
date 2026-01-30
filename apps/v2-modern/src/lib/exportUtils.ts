/**
 * エクスポートユーティリティ
 * Phase 2.3: HIS-04 CSV/JSONエクスポート
 */
import type { SoloKYSession } from '@/types/ky'
import { db } from './db'
import { formatDateForFilename } from './dateUtils'

/**
 * CSVエスケープ処理
 * - ダブルクォートを2重にする
 * - カンマ、改行、ダブルクォートを含む場合はダブルクォートで囲む
 */
function escapeCSV(value: string | number | boolean | null | undefined): string {
    if (value === null || value === undefined) return ''
    const str = String(value)
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`
    }
    return str
}

/**
 * セッションをCSV行に変換
 */
function sessionToCSVRow(session: SoloKYSession): string {
    const fields = [
        session.id,
        session.createdAt,
        session.userName,
        session.siteName,
        session.weather,
        session.temperature,
        session.processPhase,
        session.healthCondition,
        session.workItems.length,
        session.workItems.map(w => w.workDescription).join('|'),
        session.actionGoal,
        session.hadNearMiss,
        session.nearMissNote,
        session.completedAt,
    ]
    return fields.map(escapeCSV).join(',')
}

/**
 * CSVヘッダー
 */
const CSV_HEADER = [
    'ID',
    '作成日時',
    '作業者名',
    '現場名',
    '天候',
    '気温',
    '工程',
    '体調',
    '作業数',
    '作業内容',
    '行動目標',
    'ヒヤリハット',
    'ヒヤリハット備考',
    '完了日時',
].join(',')

/**
 * 全セッションをJSON形式でエクスポート
 * @returns true: 成功, false: 失敗
 */
export async function exportToJSON(): Promise<boolean> {
    try {
        const sessions = await db.sessions.toArray()
        const json = JSON.stringify(sessions, null, 2)
        const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
        downloadBlob(blob, `ky-records-${formatDateForFilename(new Date())}.json`)
        return true
    } catch (e) {
        console.error('JSON export failed:', e)
        return false
    }
}

/**
 * 全セッションをCSV形式でエクスポート
 * @returns true: 成功, false: 失敗
 */
export async function exportToCSV(): Promise<boolean> {
    try {
        const sessions = await db.sessions.toArray()
        const rows = sessions.map(sessionToCSVRow)
        const csv = [CSV_HEADER, ...rows].join('\n')
        // BOM付きUTF-8でExcelでも文字化けしない
        const bom = '\uFEFF'
        const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' })
        downloadBlob(blob, `ky-records-${formatDateForFilename(new Date())}.csv`)
        return true
    } catch (e) {
        console.error('CSV export failed:', e)
        return false
    }
}

/**
 * Blobをダウンロード
 */
function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}
