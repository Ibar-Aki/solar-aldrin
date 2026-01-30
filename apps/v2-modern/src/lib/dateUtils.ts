/**
 * 日付フォーマットユーティリティ
 * FIX-08: 共通化
 */

/**
 * 日付を短いフォーマットで表示（一覧用）
 */
export function formatDate(isoString: string): string {
    const date = new Date(isoString)
    return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

/**
 * 日付を長いフォーマットで表示（詳細用）
 */
export function formatDateLong(isoString: string | null): string {
    if (!isoString) return '-'
    const date = new Date(isoString)
    return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

/**
 * 日付をファイル名用にフォーマット
 */
export function formatDateForFilename(date: Date): string {
    return date.toISOString().slice(0, 10) // YYYY-MM-DD
}
