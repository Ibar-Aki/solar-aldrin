/**
 * チャットAPIルート
 * OpenAI / Gemini (OpenAI互換) を使用
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { ChatRequestSchema } from '../../src/lib/schema'
import { resolveAIProvider, resolveProviderApiKey, type AIProvider } from '../lib/aiProvider'
import {
    buildExecutionProfile,
    getProviderDisplayName,
    isTruthyFlag,
    MAX_TOTAL_INPUT_LENGTH,
    resolveFallbackOpenAIModel,
    resolveParseRecoveryMaxTokens,
    resolvePolicyVersion,
    resolvePrimaryAIModel,
    resolveRuntimeConfig,
} from '../lib/chat/config'
import { buildReferenceContextMessage, hasBannedWord, isQuickInteraction, limitChatHistory } from '../lib/chat/context'
import { runChatCompletionFlow } from '../lib/chat/execution'
import { formatUpstreamAIErrorMessage, getErrorStatus } from '../lib/chat/errors'
import { OpenAIHTTPErrorWithDetails } from '../lib/openai'
import { logError } from '../observability/logger'
import type { Bindings } from '../types'

const chat = new Hono<{
    Bindings: Bindings
    Variables: {
        reqId: string
    }
}>()

/**
 * POST /api/chat
 * AIとの対話 (Returns JSON with reply and extraction)
 */
chat.post('/', zValidator('json', ChatRequestSchema, (result, c) => {
    if (!result.success) {
        return c.json({ error: 'Validation Error', code: 'VALIDATION_ERROR', details: result.error }, 400)
    }
}), async (c) => {
    const reqId = c.get('reqId')
    const aiProvider = resolveAIProvider(c.env.AI_PROVIDER)
    const aiModel = resolvePrimaryAIModel(aiProvider, c.env)
    const apiKey = resolveProviderApiKey(aiProvider, c.env)
    const providerFallbackEnabled = isTruthyFlag(c.env.ENABLE_PROVIDER_FALLBACK)
    const fallbackProvider: AIProvider | null = aiProvider === 'gemini' ? 'openai' : null
    const fallbackApiKey = fallbackProvider ? resolveProviderApiKey(fallbackProvider, c.env) : undefined
    const fallbackModel = fallbackProvider ? resolveFallbackOpenAIModel(c.env) : undefined

    if (!apiKey) {
        const missingCode = aiProvider === 'gemini' ? 'GEMINI_KEY_MISSING' : 'OPENAI_KEY_MISSING'
        const providerName = getProviderDisplayName(aiProvider)
        return c.json({ error: `${providerName} API key not configured`, code: missingCode, requestId: reqId }, 500)
    }

    const { messages, sessionContext, contextInjection, conversationSummary } = c.req.valid('json')

    // 入力検証（禁止語・文字数制限）
    let totalLength = 0
    for (const msg of messages) {
        totalLength += msg.content.length
        if (msg.role === 'user' && hasBannedWord(msg.content)) {
            return c.json({ error: '禁止語が含まれています', code: 'BANNED_WORD', requestId: reqId }, 400)
        }
    }

    if (totalLength > MAX_TOTAL_INPUT_LENGTH) {
        return c.json({ error: `メッセージ全体の合計が${MAX_TOTAL_INPUT_LENGTH}文字を超えています（現在: ${totalLength}文字）`, code: 'INPUT_TOO_LARGE', requestId: reqId }, 400)
    }

    const limitedHistory = limitChatHistory(messages)
    const contextEnabled = c.env.ENABLE_CONTEXT_INJECTION !== '0'
    const referenceMessage = buildReferenceContextMessage(
        contextEnabled ? contextInjection : undefined,
        conversationSummary,
        sessionContext
    )

    try {
        const runtimeConfig = resolveRuntimeConfig(aiProvider, c.env)
        const initialProfileName = isQuickInteraction(limitedHistory, sessionContext)
            ? 'quick'
            : 'standard'
        const initialProfile = buildExecutionProfile(initialProfileName, runtimeConfig)
        const recoveryProfile = buildExecutionProfile('recovery', runtimeConfig)
        const parseRecoveryMaxTokens = resolveParseRecoveryMaxTokens(aiProvider)
        const policyVersion = resolvePolicyVersion(c.env)

        const result = await runChatCompletionFlow({
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
            aiRetryCount: runtimeConfig.retryCount,
            aiMaxTokens: runtimeConfig.maxTokens,
        })

        if (result.kind === 'invalid_json') {
            logError('json_parse_failed_strict_schema', {
                reqId,
                finishReason: result.finishReason,
                preview: result.preview,
            })
            c.header('Retry-After', '1')
            return c.json({
                error: 'AIからの応答が不正な形式です。再試行してください。',
                code: 'AI_RESPONSE_INVALID_JSON',
                requestId: reqId,
                retriable: true,
                details: {
                    finishReason: result.finishReason,
                    preview: result.preview,
                },
                meta: result.meta,
            }, 502)
        }

        if (result.kind === 'invalid_schema') {
            logError('response_schema_validation_error', {
                reqId,
                finishReason: result.details.finishReason,
                issueCount: result.details.issueCount,
                issuesPreview: result.issuesPreview || null,
            })
            // UX: 再送で回復する可能性があるため、短い待機を推奨する
            c.header('Retry-After', '1')
            return c.json({
                error: 'AIからの応答が不正な形式です。再試行してください。',
                code: 'AI_RESPONSE_INVALID_SCHEMA',
                requestId: reqId,
                retriable: true,
                details: result.details,
                meta: result.meta,
            }, 502)
        }

        return c.json({
            reply: result.reply,
            extracted: result.extracted,
            usage: result.usage,
            meta: result.meta,
        })

    } catch (error) {
        if (
            error instanceof Error &&
            (error.message === 'TIMEOUT' || error.message === 'TIMEOUT_SOFT' || error.message === 'TIMEOUT_HARD')
        ) {
            const timeoutDetailTier = error.message === 'TIMEOUT_HARD' ? 'hard' : 'soft'
            c.header('Retry-After', timeoutDetailTier === 'hard' ? '2' : '1')
            return c.json({
                error: 'AI応答がタイムアウトしました',
                code: 'AI_TIMEOUT',
                requestId: reqId,
                retriable: true,
                details: {
                    timeoutTier: timeoutDetailTier,
                },
            }, 504)
        }

        if (error instanceof OpenAIHTTPErrorWithDetails) {
            const mapped = formatUpstreamAIErrorMessage(error)
            // Prefer upstream Retry-After if present (especially for 429), but keep a conservative default.
            if (mapped.retriable) {
                const retryAfter = typeof error.retryAfterSec === 'number' && error.retryAfterSec > 0
                    ? String(Math.min(30, error.retryAfterSec))
                    : (mapped.status === 429 ? '3' : '2')
                c.header('Retry-After', retryAfter)
            }
            return c.json({
                error: mapped.message,
                code: mapped.code,
                requestId: reqId,
                retriable: mapped.retriable,
            }, mapped.status as 429 | 500 | 502 | 503 | 504)
        }

        const status = getErrorStatus(error)
        if (status === 429 || (status !== undefined && status >= 500)) {
            const retriableStatus: 429 | 500 | 502 | 503 | 504 =
                status === 429 ? 429 :
                    status === 500 ? 500 :
                        status === 502 ? 502 :
                            status === 504 ? 504 : 503
            c.header('Retry-After', status === 429 ? '3' : '2')
            return c.json({ error: 'AIサービスが混雑しています', code: 'AI_UPSTREAM_ERROR', requestId: reqId, retriable: true }, retriableStatus)
        }

        const message = error instanceof Error ? error.message : 'unknown_error'
        logError('chat_processing_error', {
            reqId,
            message,
        })
        return c.json({ error: 'システムエラーが発生しました', code: 'CHAT_PROCESSING_ERROR', requestId: reqId }, 500)
    }
})

export { chat }
