import { USER_CONTENT_MAX_LENGTH } from '../../../src/lib/schema'
import type { Bindings } from '../../types'
import {
    DEFAULT_AI_MODELS,
    resolveModelByProvider,
    type AIProvider,
} from '../aiProvider'

export const MAX_HISTORY_TURNS = 10
export const MAX_TOTAL_INPUT_LENGTH = USER_CONTENT_MAX_LENGTH * 10
const MAX_TOKENS = 900
const PARSE_RECOVERY_MAX_TOKENS = 2500
const QUICK_PROFILE_MAX_TOKENS = 1000
const QUICK_PROFILE_SOFT_TIMEOUT_MS = 16000
const QUICK_PROFILE_HARD_TIMEOUT_MS = 24000
const STANDARD_PROFILE_HARD_TIMEOUT_MS_OFFSET = 10000
const RECOVERY_PROFILE_SOFT_TIMEOUT_MS = 32000
const RECOVERY_PROFILE_HARD_TIMEOUT_MS = 45000
const GEMINI_DEFAULT_TIMEOUT_MS = 18000
const GEMINI_DEFAULT_RETRY_COUNT = 0
const GEMINI_DEFAULT_MAX_TOKENS = 700
const GEMINI_PARSE_RECOVERY_MAX_TOKENS = 1800
const GEMINI_QUICK_PROFILE_MAX_TOKENS = 700
const GEMINI_QUICK_PROFILE_SOFT_TIMEOUT_MS = 12000
const GEMINI_QUICK_PROFILE_HARD_TIMEOUT_MS = 18000
const GEMINI_STANDARD_PROFILE_HARD_TIMEOUT_MS_OFFSET = 7000
const GEMINI_RECOVERY_PROFILE_SOFT_TIMEOUT_MS = 22000
const GEMINI_RECOVERY_PROFILE_HARD_TIMEOUT_MS = 30000
const DEFAULT_POLICY_VERSION = '2026-02-11-a-b-observability-1'

export const COUNTERMEASURE_CATEGORY_ENUM = ['ppe', 'behavior', 'equipment'] as const
export const NEXT_ACTION_ENUM = [
    'ask_work',
    'ask_hazard',
    'ask_why',
    'ask_countermeasure',
    'ask_risk_level',
    'ask_more_work',
    'ask_goal',
    'confirm',
    'completed',
] as const
export const CHAT_RESPONSE_JSON_SCHEMA = {
    name: 'ky_chat_response',
    strict: true,
    schema: {
        type: 'object',
        additionalProperties: false,
        required: ['reply', 'extracted'],
        properties: {
            reply: { type: 'string' },
            extracted: {
                type: 'object',
                additionalProperties: false,
                required: [
                    'nextAction',
                    'workDescription',
                    'hazardDescription',
                    'whyDangerous',
                    'countermeasures',
                    'riskLevel',
                    'actionGoal',
                ],
                properties: {
                    nextAction: { type: 'string', enum: NEXT_ACTION_ENUM },
                    workDescription: { type: ['string', 'null'] },
                    hazardDescription: { type: ['string', 'null'] },
                    whyDangerous: {
                        anyOf: [
                            {
                                type: 'array',
                                items: { type: 'string' },
                                maxItems: 3,
                            },
                            { type: 'null' },
                        ],
                    },
                    countermeasures: {
                        anyOf: [
                            {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    additionalProperties: false,
                                    required: ['category', 'text'],
                                    properties: {
                                        category: { type: 'string', enum: COUNTERMEASURE_CATEGORY_ENUM },
                                        text: { type: 'string' },
                                    },
                                },
                            },
                            { type: 'null' },
                        ],
                    },
                    riskLevel: {
                        type: ['integer', 'null'],
                        enum: [1, 2, 3, 4, 5, null],
                    },
                    actionGoal: { type: ['string', 'null'] },
                },
            },
        },
    },
} as const

export type ChatResponseFormatType = 'json_schema_strict' | 'json_object'
export type ChatExecutionProfileName = 'quick' | 'standard' | 'recovery'

export type RuntimeConfig = {
    provider: AIProvider
    timeoutMs: number
    retryCount: number
    maxTokens: number
}

export type ChatExecutionProfile = {
    name: ChatExecutionProfileName
    maxTokens: number
    softTimeoutMs: number
    hardTimeoutMs: number
    retryCount: number
    temperature: number
}

export function getProviderDisplayName(provider: AIProvider): string {
    return provider === 'gemini' ? 'Gemini' : 'OpenAI'
}

export function resolvePrimaryAIModel(provider: AIProvider, env: Bindings): string {
    return resolveModelByProvider(provider, env, DEFAULT_AI_MODELS)
}

export function resolveFallbackOpenAIModel(env: Bindings): string {
    return env.OPENAI_MODEL?.trim() || DEFAULT_AI_MODELS.openai
}

export function resolveResponseFormat(provider: AIProvider): {
    type: 'json_object'
} | {
    type: 'json_schema'
    json_schema: typeof CHAT_RESPONSE_JSON_SCHEMA
} {
    if (provider === 'gemini') {
        return { type: 'json_object' }
    }
    return {
        type: 'json_schema',
        json_schema: CHAT_RESPONSE_JSON_SCHEMA,
    }
}

export function resolveResponseFormatLabel(provider: AIProvider): ChatResponseFormatType {
    return provider === 'gemini' ? 'json_object' : 'json_schema_strict'
}

function parseOptionalInt(raw: string | undefined): number | undefined {
    const parsed = raw ? Number.parseInt(raw.trim(), 10) : NaN
    return Number.isFinite(parsed) ? parsed : undefined
}

function resolveTimeoutMs(raw: string | undefined, defaultValue: number): number {
    const parsed = parseOptionalInt(raw)
    if (parsed !== undefined && parsed >= 1000 && parsed <= 120000) return parsed
    return defaultValue
}

function resolveRetryCount(raw: string | undefined, defaultValue: number): number {
    const parsed = parseOptionalInt(raw)
    if (parsed !== undefined && parsed >= 0 && parsed <= 2) return parsed
    return defaultValue
}

function resolveMaxTokens(raw: string | undefined, defaultValue: number): number {
    const parsed = parseOptionalInt(raw)
    if (parsed !== undefined && parsed >= 300 && parsed <= 4000) return parsed
    return defaultValue
}

function resolveOpenAITimeoutMs(raw: string | undefined): number {
    const parsed = raw ? Number.parseInt(raw.trim(), 10) : NaN
    // LIVEでは10sだと普通に超えるため、デフォルトは25sに上げる（E2E側は90s待てる設計）
    if (Number.isFinite(parsed) && parsed >= 1000 && parsed <= 120000) return parsed
    return 25000
}

function resolveOpenAIRetryCount(raw: string | undefined): number {
    const parsed = raw ? Number.parseInt(raw.trim(), 10) : NaN
    // 応答時間短縮のため既定は1回。環境変数で0〜2の範囲のみ許可する。
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 2) return parsed
    return 1
}

function resolveOpenAIMaxTokens(raw: string | undefined): number {
    const parsed = raw ? Number.parseInt(raw.trim(), 10) : NaN
    // Structured output の安定性と応答時間のバランスを取り、範囲を制限する。
    if (Number.isFinite(parsed) && parsed >= 300 && parsed <= 4000) return parsed
    return MAX_TOKENS
}

function resolveGeminiTimeoutMs(raw: string | undefined): number {
    return resolveTimeoutMs(raw, GEMINI_DEFAULT_TIMEOUT_MS)
}

function resolveGeminiRetryCount(raw: string | undefined): number {
    return resolveRetryCount(raw, GEMINI_DEFAULT_RETRY_COUNT)
}

function resolveGeminiMaxTokens(raw: string | undefined): number {
    return resolveMaxTokens(raw, GEMINI_DEFAULT_MAX_TOKENS)
}

function clampNumber(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
}

export function resolveRuntimeConfig(provider: AIProvider, env: Bindings): RuntimeConfig {
    if (provider === 'gemini') {
        return {
            provider,
            timeoutMs: resolveGeminiTimeoutMs(env.GEMINI_TIMEOUT_MS),
            retryCount: resolveGeminiRetryCount(env.GEMINI_RETRY_COUNT),
            maxTokens: resolveGeminiMaxTokens(env.GEMINI_MAX_TOKENS),
        }
    }

    return {
        provider,
        timeoutMs: resolveOpenAITimeoutMs(env.OPENAI_TIMEOUT_MS),
        retryCount: resolveOpenAIRetryCount(env.OPENAI_RETRY_COUNT),
        maxTokens: resolveOpenAIMaxTokens(env.OPENAI_MAX_TOKENS),
    }
}

export function resolveParseRecoveryMaxTokens(provider: AIProvider): number {
    return provider === 'gemini' ? GEMINI_PARSE_RECOVERY_MAX_TOKENS : PARSE_RECOVERY_MAX_TOKENS
}

export function isTruthyFlag(raw: string | undefined): boolean {
    const normalized = raw?.trim().toLowerCase()
    return normalized === '1' || normalized === 'true'
}

export function resolvePolicyVersion(env: Bindings): string {
    return env.AI_POLICY_VERSION?.trim()
        || env.SENTRY_RELEASE?.trim()
        || DEFAULT_POLICY_VERSION
}

export function buildExecutionProfile(name: ChatExecutionProfileName, runtime: RuntimeConfig): ChatExecutionProfile {
    const isGemini = runtime.provider === 'gemini'
    const quickProfileMaxTokens = isGemini ? GEMINI_QUICK_PROFILE_MAX_TOKENS : QUICK_PROFILE_MAX_TOKENS
    const quickProfileSoftTimeoutMs = isGemini ? GEMINI_QUICK_PROFILE_SOFT_TIMEOUT_MS : QUICK_PROFILE_SOFT_TIMEOUT_MS
    const quickProfileHardTimeoutMs = isGemini ? GEMINI_QUICK_PROFILE_HARD_TIMEOUT_MS : QUICK_PROFILE_HARD_TIMEOUT_MS
    const parseRecoveryMaxTokens = isGemini ? GEMINI_PARSE_RECOVERY_MAX_TOKENS : PARSE_RECOVERY_MAX_TOKENS
    const recoveryProfileSoftTimeoutMs = isGemini ? GEMINI_RECOVERY_PROFILE_SOFT_TIMEOUT_MS : RECOVERY_PROFILE_SOFT_TIMEOUT_MS
    const recoveryProfileHardTimeoutMs = isGemini ? GEMINI_RECOVERY_PROFILE_HARD_TIMEOUT_MS : RECOVERY_PROFILE_HARD_TIMEOUT_MS
    const standardHardTimeoutOffset = isGemini ? GEMINI_STANDARD_PROFILE_HARD_TIMEOUT_MS_OFFSET : STANDARD_PROFILE_HARD_TIMEOUT_MS_OFFSET

    if (name === 'quick') {
        const maxTokens = clampNumber(Math.min(runtime.maxTokens, quickProfileMaxTokens), 300, 4000)
        const softTimeoutMs = clampNumber(Math.min(runtime.timeoutMs, quickProfileSoftTimeoutMs), 1000, 120000)
        const hardTimeoutMs = clampNumber(
            Math.max(softTimeoutMs + 4000, quickProfileHardTimeoutMs),
            softTimeoutMs,
            120000
        )
        return {
            name,
            maxTokens,
            softTimeoutMs,
            hardTimeoutMs,
            retryCount: 0,
            temperature: 0.2,
        }
    }

    if (name === 'recovery') {
        const maxTokens = clampNumber(Math.max(runtime.maxTokens, parseRecoveryMaxTokens), 300, 4000)
        const softTimeoutMs = clampNumber(Math.max(runtime.timeoutMs, recoveryProfileSoftTimeoutMs), 1000, 120000)
        const hardTimeoutMs = clampNumber(
            Math.max(softTimeoutMs + 5000, recoveryProfileHardTimeoutMs),
            softTimeoutMs,
            120000
        )
        return {
            name,
            maxTokens,
            softTimeoutMs,
            hardTimeoutMs,
            retryCount: clampNumber(runtime.retryCount, 0, 1),
            temperature: 0.2,
        }
    }

    const softTimeoutMs = clampNumber(runtime.timeoutMs, 1000, 120000)
    const hardTimeoutMs = clampNumber(
        Math.max(softTimeoutMs + 3000, softTimeoutMs + standardHardTimeoutOffset),
        softTimeoutMs,
        120000
    )
    return {
        name,
        maxTokens: runtime.maxTokens,
        softTimeoutMs,
        hardTimeoutMs,
        retryCount: runtime.retryCount,
        temperature: 0.3,
    }
}
