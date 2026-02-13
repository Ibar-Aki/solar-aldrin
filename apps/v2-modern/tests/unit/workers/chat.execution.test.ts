import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildExecutionProfile, resolveParseRecoveryMaxTokens, type RuntimeConfig } from '../../../workers/lib/chat/config'
import { runChatCompletionFlow } from '../../../workers/lib/chat/execution'

function buildProfiles(runtimeConfig: RuntimeConfig) {
    return {
        initialProfile: buildExecutionProfile('standard', runtimeConfig),
        recoveryProfile: buildExecutionProfile('recovery', runtimeConfig),
    }
}

describe('runChatCompletionFlow', () => {
    beforeEach(() => {
        vi.resetAllMocks()
        global.fetch = vi.fn()
    })

    it('finish_reason=length の壊れたJSONは1回だけ再生成して回復する', async () => {
        vi.mocked(fetch)
            .mockResolvedValueOnce(new Response(JSON.stringify({
                choices: [{
                    message: { content: '{"reply":"途中で切れた' },
                    finish_reason: 'length',
                }],
                usage: { total_tokens: 110 },
            }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            reply: '対策を教えてください。',
                            extracted: { nextAction: 'ask_countermeasure' },
                        }),
                    },
                    finish_reason: 'stop',
                }],
                usage: { total_tokens: 95 },
            }), { status: 200 }))

        const runtimeConfig: RuntimeConfig = {
            provider: 'openai',
            timeoutMs: 25000,
            retryCount: 0,
            maxTokens: 900,
        }
        const { initialProfile, recoveryProfile } = buildProfiles(runtimeConfig)

        const result = await runChatCompletionFlow({
            reqId: 'req-1',
            aiProvider: 'openai',
            aiModel: 'gpt-4o-mini',
            apiKey: 'test-key',
            providerFallbackEnabled: false,
            limitedHistory: [{ role: 'user', content: '次へ進めてください' }],
            initialProfile,
            recoveryProfile,
            parseRecoveryMaxTokens: resolveParseRecoveryMaxTokens('openai'),
            policyVersion: 'policy-test',
            aiRetryCount: runtimeConfig.retryCount,
            aiMaxTokens: runtimeConfig.maxTokens,
        })

        expect(result.kind).toBe('success')
        if (result.kind !== 'success') {
            throw new Error('expected success')
        }
        expect(result.meta.parseRetry.attempted).toBe(true)
        expect(result.meta.parseRetry.succeeded).toBe(true)
        expect(result.meta.ai.requestCount).toBe(2)
        expect(result.reply).toContain('対策')
    })

    it('スキーマ不整合時は invalid_schema を返す', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
            choices: [{
                message: {
                    content: JSON.stringify({
                        reply: '了解しました。',
                        extracted: { nextAction: 'invalid_action' },
                    }),
                },
                finish_reason: 'stop',
            }],
            usage: { total_tokens: 44 },
        }), { status: 200 }))

        const runtimeConfig: RuntimeConfig = {
            provider: 'openai',
            timeoutMs: 25000,
            retryCount: 0,
            maxTokens: 900,
        }
        const { initialProfile, recoveryProfile } = buildProfiles(runtimeConfig)

        const result = await runChatCompletionFlow({
            reqId: 'req-2',
            aiProvider: 'openai',
            aiModel: 'gpt-4o-mini',
            apiKey: 'test-key',
            providerFallbackEnabled: false,
            limitedHistory: [{ role: 'user', content: '次へ進めてください' }],
            initialProfile,
            recoveryProfile,
            parseRecoveryMaxTokens: resolveParseRecoveryMaxTokens('openai'),
            policyVersion: 'policy-test',
            aiRetryCount: runtimeConfig.retryCount,
            aiMaxTokens: runtimeConfig.maxTokens,
        })

        expect(result.kind).toBe('invalid_schema')
        if (result.kind !== 'invalid_schema') {
            throw new Error('expected invalid_schema')
        }
        expect(result.details.issueCount).toBeGreaterThan(0)
        expect(result.meta.parseRetry.attempted).toBe(false)
    })
})
