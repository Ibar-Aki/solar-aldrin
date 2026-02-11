import { describe, expect, it } from 'vitest'
import { parseBooleanFlag, resolveBooleanFlag } from '@/lib/envFlags'

describe('envFlags', () => {
    it('parseBooleanFlag が true/false の代表値を解釈できる', () => {
        expect(parseBooleanFlag('1')).toBe(true)
        expect(parseBooleanFlag('true')).toBe(true)
        expect(parseBooleanFlag('yes')).toBe(true)
        expect(parseBooleanFlag('on')).toBe(true)

        expect(parseBooleanFlag('0')).toBe(false)
        expect(parseBooleanFlag('false')).toBe(false)
        expect(parseBooleanFlag('no')).toBe(false)
        expect(parseBooleanFlag('off')).toBe(false)
    })

    it('parseBooleanFlag は未知値を null にする', () => {
        expect(parseBooleanFlag(undefined)).toBeNull()
        expect(parseBooleanFlag(null)).toBeNull()
        expect(parseBooleanFlag('')).toBeNull()
        expect(parseBooleanFlag('enabled')).toBeNull()
    })

    it('resolveBooleanFlag は未知値のとき既定値を返す', () => {
        expect(resolveBooleanFlag('true', false)).toBe(true)
        expect(resolveBooleanFlag('false', true)).toBe(false)
        expect(resolveBooleanFlag('maybe', true)).toBe(true)
        expect(resolveBooleanFlag(undefined, false)).toBe(false)
    })
})
