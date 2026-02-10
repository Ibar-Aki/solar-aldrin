/**
 * 「なし/特になし/ありません」等の非回答テキスト判定
 * - 対策/要因の抽出結果に混入しても、保存・完了判定にカウントさせないために利用する。
 */

const TRAILING_PUNCTUATION_RE = /[。．.!！?？、,]+$/g
const WHITESPACE_RE = /[\s\u3000]+/g // ASCII空白 + 全角スペース

function normalizeForNonAnswerCheck(value: string): string {
    return value
        .trim()
        .replace(TRAILING_PUNCTUATION_RE, '')
        .replace(WHITESPACE_RE, '')
        .trim()
}

/**
 * 「なし」「特になし」「ありません」など、実質的に「回答なし」を意味する短文かどうか。
 * NOTE: 文中の「〜がありません」のようなケースを誤判定しないため、"全文一致" のみ判定する。
 */
export function isNonAnswerText(value: string): boolean {
    const normalized = normalizeForNonAnswerCheck(value)
    if (!normalized) return true

    return /^(?:特に)?(?:なし|無し|ない|無い|ありません|有りません)(?:です|でした)?$/.test(normalized)
}

