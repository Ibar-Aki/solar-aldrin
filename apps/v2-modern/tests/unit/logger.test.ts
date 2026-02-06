import { describe, expect, it, vi, afterEach } from 'vitest'
import { logInfo, sanitizeLogContext } from '../../workers/observability/logger'

describe('logger masking', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('PIIと秘密情報をマスクする', () => {
        const sanitized = sanitizeLogContext({
            userName: '田中太郎',
            siteName: '現場A',
            note: '連絡先 tanaka@example.com / 090-1234-5678 / 12345678',
            authorization: 'Bearer abcdefghijklmnop',
            tokenFingerprint: 'tk_1234abcd',
        })

        expect(sanitized.userName).toBe('[redacted]')
        expect(sanitized.siteName).toBe('[redacted]')
        expect(String(sanitized.note)).toContain('[email]')
        expect(String(sanitized.note)).toContain('[phone]')
        expect(String(sanitized.note)).toContain('[number]')
        expect(sanitized.authorization).toBe('[redacted]')
        expect(sanitized.tokenFingerprint).toBe('tk_1234abcd')
    })

    it('logInfo出力でもマスクされた値が使われる', () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => { })

        logInfo('test_log', {
            note: 'mail: a@example.com',
            userName: 'A',
        })

        const line = String(spy.mock.calls[0]?.[0] ?? '')
        const payload = JSON.parse(line) as { note: string; userName: string }

        expect(payload.note).toContain('[email]')
        expect(payload.userName).toBe('[redacted]')
    })
})
