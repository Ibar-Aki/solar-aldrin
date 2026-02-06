import { describe, expect, it } from 'vitest'
import {
    isProductionEnv,
    shouldRequireApiToken,
    shouldRequireRateLimitKV,
    shouldUseStrictCors,
} from '../../workers/lib/securityMode'

describe('securityMode helpers', () => {
    it('ENVIRONMENT / SENTRY_ENV が production の場合は本番扱いになる', () => {
        expect(isProductionEnv({ ENVIRONMENT: 'production' })).toBe(true)
        expect(isProductionEnv({ SENTRY_ENV: 'prod' })).toBe(true)
        expect(isProductionEnv({ SENTRY_ENV: 'local' })).toBe(false)
    })

    it('APIトークン必須判定は明示フラグを優先する', () => {
        expect(shouldRequireApiToken({ REQUIRE_API_TOKEN: '1', SENTRY_ENV: 'local' })).toBe(true)
        expect(shouldRequireApiToken({ REQUIRE_API_TOKEN: '0', SENTRY_ENV: 'production' })).toBe(false)
        expect(shouldRequireApiToken({ SENTRY_ENV: 'production' })).toBe(true)
        expect(shouldRequireApiToken({ SENTRY_ENV: 'local' })).toBe(false)
    })

    it('RATE_LIMIT_KV必須判定とCORS厳格判定は本番デフォルトになる', () => {
        expect(shouldRequireRateLimitKV({ SENTRY_ENV: 'production' })).toBe(true)
        expect(shouldRequireRateLimitKV({ SENTRY_ENV: 'local' })).toBe(false)
        expect(shouldUseStrictCors({ ENVIRONMENT: 'production' })).toBe(true)
        expect(shouldUseStrictCors({ ENVIRONMENT: 'dev' })).toBe(false)
    })
})
