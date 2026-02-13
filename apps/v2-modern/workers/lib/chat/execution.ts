import { ChatSuccessResponseSchema } from '../../../src/lib/schema'
import type { ExtractedData } from '../../../src/types/ky'
import { SOLO_KY_SYSTEM_PROMPT } from '../../prompts/soloKY'
import { type AIProvider } from '../aiProvider'
import { fetchOpenAICompletion, safeParseJSON, OpenAIHTTPErrorWithDetails } from '../openai'
import { type ChatExecutionProfile, resolveResponseFormat, resolveResponseFormatLabel } from './config'
import { type SchemaIssueSummary, summarizeSchemaValidationError } from './errors'
import { compactExtractedData, normalizeModelResponse } from './normalize'

type ParseRetryMeta = {
    attempted: boolean
    succeeded: boolean
}

type AIUsageMeta = {
    requestCount: number
    httpAttempts: number
    durationMs: number
    finishReason: string | null
}

type ServerPolicyMeta = {
    policyVersion: string
    responseFormat: 'json_schema_strict' | 'json_object'
    parseRecoveryEnabled: true
    openaiRetryCount: number
    aiRetryCount: number
    maxTokens: number
    aiProvider: AIProvider
    aiModel: string
    aiProviderEffective: AIProvider
    aiModelEffective: string
    aiProviderFallbackUsed: boolean
    providerFallbackEnabled: boolean
    responseFormatEffective: 'json_schema_strict' | 'json_object'
    profileName: ChatExecutionProfile['name']
    profileRetryCount: number
    profileMaxTokens: number
    profileSoftTimeoutMs: number
    profileHardTimeoutMs: number
    timeoutSoftRecoveryCount: number
    timeoutHardFailureCount: number
    timeoutTier: 'none' | 'soft_recovered' | 'hard_timeout'
}

type ChatExecutionMeta = {
    ai: AIUsageMeta
    openai: AIUsageMeta
    parseRetry: ParseRetryMeta
    server: ServerPolicyMeta
}

type ChatExecutionState = {
    aiRequestCount: number
    aiHttpAttempts: number
    aiDurationMs: number
    aiLastFinishReason: string | null | undefined
    totalTokens: number
    parseRetryAttempted: boolean
    parseRetrySucceeded: boolean
    activeProfile: ChatExecutionProfile
    timeoutSoftRecoveryCount: number
    timeoutHardFailureCount: number
    timeoutTier: 'none' | 'soft_recovered' | 'hard_timeout'
    effectiveProvider: AIProvider
    effectiveModel: string
    providerFallbackUsed: boolean
}

type ChatExecutionSuccess = {
    kind: 'success'
    reply: string
    extracted: ExtractedData | Record<string, never>
    usage: {
        totalTokens: number
    }
    meta: ChatExecutionMeta
}

type ChatExecutionInvalidJson = {
    kind: 'invalid_json'
    preview: string
    finishReason: string | null
    meta: ChatExecutionMeta
}

type ChatExecutionInvalidSchema = {
    kind: 'invalid_schema'
    details: {
        reason: 'schema_validation_failed'
        finishReason: string | null
        issueCount: number
        issues: SchemaIssueSummary[]
    }
    issuesPreview: string
    meta: ChatExecutionMeta
}

export type ChatExecutionResult = ChatExecutionSuccess | ChatExecutionInvalidJson | ChatExecutionInvalidSchema

export type RunChatCompletionFlowParams = {
    reqId: string
    aiProvider: AIProvider
    aiModel: string
    apiKey: string
    providerFallbackEnabled: boolean
    fallbackApiKey?: string
    fallbackModel?: string
    limitedHistory: Array<{ role: 'user' | 'assistant'; content: string }>
    referenceMessage?: string
    initialProfile: ChatExecutionProfile
    recoveryProfile: ChatExecutionProfile
    parseRecoveryMaxTokens: number
    policyVersion: string
    aiRetryCount: number
    aiMaxTokens: number
}

export async function runChatCompletionFlow(params: RunChatCompletionFlowParams): Promise<ChatExecutionResult> {
    const {
        reqId,
        aiProvider,
        aiModel,
        apiKey,
        providerFallbackEnabled,
        fallbackApiKey,
        fallbackModel,
        limitedHistory,
        referenceMessage,
        initialProfile,
        recoveryProfile,
        parseRecoveryMaxTokens,
        policyVersion,
        aiRetryCount,
        aiMaxTokens,
    } = params

    const requestBodyBase = {
        messages: [
            { role: 'system', content: SOLO_KY_SYSTEM_PROMPT },
            ...(referenceMessage ? [{ role: 'user', content: referenceMessage }] : []),
            ...limitedHistory,
        ],
    }

    const state: ChatExecutionState = {
        aiRequestCount: 0,
        aiHttpAttempts: 0,
        aiDurationMs: 0,
        aiLastFinishReason: null,
        totalTokens: 0,
        parseRetryAttempted: false,
        parseRetrySucceeded: false,
        activeProfile: initialProfile,
        timeoutSoftRecoveryCount: 0,
        timeoutHardFailureCount: 0,
        timeoutTier: 'none',
        effectiveProvider: aiProvider,
        effectiveModel: aiModel,
        providerFallbackUsed: false,
    }

    const buildAiUsageMeta = (): AIUsageMeta => ({
        requestCount: state.aiRequestCount,
        httpAttempts: state.aiHttpAttempts,
        durationMs: state.aiDurationMs,
        finishReason: state.aiLastFinishReason ?? null,
    })

    const buildServerPolicyMeta = (): ServerPolicyMeta => ({
        policyVersion,
        responseFormat: resolveResponseFormatLabel(aiProvider),
        parseRecoveryEnabled: true,
        // Backward-compatible fields for existing preflight/e2e checks.
        openaiRetryCount: aiRetryCount,
        aiRetryCount,
        maxTokens: aiMaxTokens,
        aiProvider,
        aiModel,
        aiProviderEffective: state.effectiveProvider,
        aiModelEffective: state.effectiveModel,
        aiProviderFallbackUsed: state.providerFallbackUsed,
        providerFallbackEnabled,
        responseFormatEffective: resolveResponseFormatLabel(state.effectiveProvider),
        // Dynamic profile fields for observability.
        profileName: state.activeProfile.name,
        profileRetryCount: state.activeProfile.retryCount,
        profileMaxTokens: state.activeProfile.maxTokens,
        profileSoftTimeoutMs: state.activeProfile.softTimeoutMs,
        profileHardTimeoutMs: state.activeProfile.hardTimeoutMs,
        timeoutSoftRecoveryCount: state.timeoutSoftRecoveryCount,
        timeoutHardFailureCount: state.timeoutHardFailureCount,
        timeoutTier: state.timeoutTier,
    })

    const buildMeta = (): ChatExecutionMeta => {
        const ai = buildAiUsageMeta()
        return {
            ai,
            openai: ai,
            parseRetry: {
                attempted: state.parseRetryAttempted,
                succeeded: state.parseRetrySucceeded,
            },
            server: buildServerPolicyMeta(),
        }
    }

    const buildRequestBody = (
        profile: ChatExecutionProfile,
        provider: AIProvider,
        model: string,
        overrides?: Partial<Record<'max_tokens' | 'temperature', number>>
    ): Record<string, unknown> => ({
        ...requestBodyBase,
        model,
        response_format: resolveResponseFormat(provider),
        max_tokens: overrides?.max_tokens ?? profile.maxTokens,
        temperature: overrides?.temperature ?? profile.temperature,
    })

    const callOpenAISingle = async (
        body: Record<string, unknown>,
        profile: ChatExecutionProfile,
        timeoutMs: number,
        retryCount: number,
        provider: AIProvider,
        providerApiKey: string,
        model: string
    ) => {
        state.activeProfile = profile
        state.effectiveProvider = provider
        state.effectiveModel = model
        state.aiRequestCount += 1
        const responseData = await fetchOpenAICompletion({
            apiKey: providerApiKey,
            body,
            reqId,
            timeoutMs,
            retryCount,
            provider,
        })
        state.totalTokens += responseData.usage?.total_tokens ?? 0
        state.aiHttpAttempts += responseData.meta.httpAttempts
        state.aiDurationMs += responseData.meta.durationMs
        state.aiLastFinishReason = responseData.meta.finishReason
        return responseData
    }

    const callOpenAI = async (
        body: Record<string, unknown>,
        profile: ChatExecutionProfile,
        provider: AIProvider,
        providerApiKey: string,
        model: string
    ) => {
        try {
            return await callOpenAISingle(body, profile, profile.softTimeoutMs, profile.retryCount, provider, providerApiKey, model)
        } catch (error) {
            if (!(error instanceof Error) || error.message !== 'TIMEOUT') {
                throw error
            }

            if (profile.hardTimeoutMs <= profile.softTimeoutMs) {
                throw new Error('TIMEOUT_SOFT')
            }

            state.timeoutSoftRecoveryCount += 1
            state.timeoutTier = 'soft_recovered'
            try {
                return await callOpenAISingle(body, profile, profile.hardTimeoutMs, 0, provider, providerApiKey, model)
            } catch (hardTimeoutError) {
                if (hardTimeoutError instanceof Error && hardTimeoutError.message === 'TIMEOUT') {
                    state.timeoutHardFailureCount += 1
                    state.timeoutTier = 'hard_timeout'
                    throw new Error('TIMEOUT_HARD')
                }
                throw hardTimeoutError
            }
        }
    }

    const isProviderFallbackError = (error: unknown): boolean => {
        if (error instanceof OpenAIHTTPErrorWithDetails) {
            if (error.status === 429) {
                return providerFallbackEnabled
            }
            return error.status >= 500
        }
        if (error instanceof Error) {
            return error.message === 'TIMEOUT' || error.message === 'TIMEOUT_SOFT' || error.message === 'TIMEOUT_HARD'
        }
        return false
    }

    const callWithProviderFallback = async (
        profile: ChatExecutionProfile,
        overrides?: Partial<Record<'max_tokens' | 'temperature', number>>
    ) => {
        const primaryBody = buildRequestBody(profile, aiProvider, aiModel, overrides)
        try {
            return await callOpenAI(primaryBody, profile, aiProvider, apiKey, aiModel)
        } catch (error) {
            const canFallback =
                aiProvider === 'gemini' &&
                Boolean(fallbackApiKey) &&
                Boolean(fallbackModel) &&
                isProviderFallbackError(error)

            if (!canFallback) {
                throw error
            }

            state.providerFallbackUsed = true
            const fallbackBody = buildRequestBody(profile, 'openai', fallbackModel as string, overrides)
            return await callOpenAI(fallbackBody, profile, 'openai', fallbackApiKey as string, fallbackModel as string)
        }
    }

    const responseSchema = ChatSuccessResponseSchema.omit({ usage: true })
    const evaluateModelOutput = (content: string) => {
        try {
            const parsed = safeParseJSON<{ reply?: string; extracted?: ExtractedData }>(content)
            const normalized = normalizeModelResponse(parsed, limitedHistory)
            const validation = responseSchema.safeParse(normalized)
            return {
                parsed,
                normalized,
                validation,
                parseFailed: false,
                preview: null as string | null,
            }
        } catch {
            const preview = content.slice(0, 240)
            return {
                parsed: null,
                normalized: null,
                validation: null,
                parseFailed: true,
                preview: preview.length > 0 ? preview : '[empty_response]',
            }
        }
    }

    const requestParseRecovery = async () => {
        state.parseRetryAttempted = true
        return callWithProviderFallback(recoveryProfile, {
            // Structured output が length で切れた時は、出力枠を増やして1回だけ再生成する。
            max_tokens: parseRecoveryMaxTokens,
            temperature: recoveryProfile.temperature,
        })
    }

    // 会話フェーズ別プロファイル（quick / standard / recovery）を適用。
    let responseData = await callWithProviderFallback(initialProfile)
    let evaluation = evaluateModelOutput(responseData.content)

    if (evaluation.parseFailed && state.aiLastFinishReason === 'length') {
        responseData = await requestParseRecovery()
        evaluation = evaluateModelOutput(responseData.content)
        state.parseRetrySucceeded = !evaluation.parseFailed && Boolean(evaluation.validation?.success)
    }

    if (evaluation.parseFailed) {
        return {
            kind: 'invalid_json',
            preview: evaluation.preview ?? '[missing_preview]',
            finishReason: state.aiLastFinishReason ?? null,
            meta: buildMeta(),
        }
    }

    if (!evaluation.validation?.success && !state.parseRetryAttempted && state.aiLastFinishReason === 'length') {
        responseData = await requestParseRecovery()
        evaluation = evaluateModelOutput(responseData.content)
        state.parseRetrySucceeded = !evaluation.parseFailed && Boolean(evaluation.validation?.success)
    }

    const finalValidation = evaluation.validation
    if (!finalValidation || !finalValidation.success) {
        const schemaSummary = summarizeSchemaValidationError(finalValidation?.error)
        const details = {
            reason: 'schema_validation_failed' as const,
            finishReason: state.aiLastFinishReason ?? null,
            issueCount: schemaSummary?.issueCount ?? 0,
            issues: schemaSummary?.issues ?? [],
        }
        const issuesPreview = details.issues
            .map((issue) => `${issue.path}:${issue.code}`)
            .slice(0, 5)
            .join('|')

        return {
            kind: 'invalid_schema',
            details,
            issuesPreview,
            meta: buildMeta(),
        }
    }

    const validContent = finalValidation.data
    const compactedExtracted = compactExtractedData(validContent.extracted)

    return {
        kind: 'success',
        reply: validContent.reply,
        extracted: compactedExtracted || {},
        usage: {
            totalTokens: state.totalTokens,
        },
        meta: buildMeta(),
    }
}
