import { describe, expect, it } from 'vitest'
import { normalizeApiBaseFromEnv } from '@/lib/apiBase'

describe('normalizeApiBaseFromEnv', () => {
    it('未指定は /api にフォールバックする', () => {
        expect(normalizeApiBaseFromEnv(undefined)).toBe('/api')
        expect(normalizeApiBaseFromEnv(null)).toBe('/api')
        expect(normalizeApiBaseFromEnv('')).toBe('/api')
        expect(normalizeApiBaseFromEnv('   ')).toBe('/api')
    })

    it('絶対URLは /api を補完する', () => {
        expect(normalizeApiBaseFromEnv('http://localhost:8787')).toBe('http://localhost:8787/api')
        expect(normalizeApiBaseFromEnv('http://localhost:8787/')).toBe('http://localhost:8787/api')
        expect(normalizeApiBaseFromEnv('https://example.com')).toBe('https://example.com/api')
        expect(normalizeApiBaseFromEnv('https://example.com/')).toBe('https://example.com/api')
    })

    it('絶対URLで既に /api がある場合は維持する', () => {
        expect(normalizeApiBaseFromEnv('http://localhost:8787/api')).toBe('http://localhost:8787/api')
        expect(normalizeApiBaseFromEnv('http://localhost:8787/api/')).toBe('http://localhost:8787/api')
        expect(normalizeApiBaseFromEnv('https://example.com/foo/api')).toBe('https://example.com/foo/api')
    })

    it('相対パスはそのまま返す（末尾スラッシュは除去）', () => {
        expect(normalizeApiBaseFromEnv('/api')).toBe('/api')
        expect(normalizeApiBaseFromEnv('/api/')).toBe('/api')
        expect(normalizeApiBaseFromEnv('/backend/api/')).toBe('/backend/api')
    })

    it('fallbackBase を指定できる', () => {
        expect(normalizeApiBaseFromEnv(undefined, '')).toBe('')
        expect(normalizeApiBaseFromEnv('', '')).toBe('')
        expect(normalizeApiBaseFromEnv('  ', '')).toBe('')
    })
})

