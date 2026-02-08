import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { FeedbackRequestSchema, FeedbackResponseSchema, type FeedbackRequest, type FeedbackResponse } from '../../src/lib/schema'
import { FEEDBACK_SYSTEM_PROMPT } from '../prompts/feedbackKY'
import { logError, logWarn } from '../observability/logger'
import { fetchOpenAICompletion, safeParseJSON, OpenAIHTTPErrorWithDetails } from '../lib/openai'

interface KVNamespace {
    get(key: string): Promise<string | null>
    put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
}

type Bindings = {
    OPENAI_API_KEY: string
    ENABLE_FEEDBACK?: string
    FEEDBACK_KV?: KVNamespace
}

const feedback = new Hono<{
    Bindings: Bindings
    Variables: {
        reqId: string
    }
}>()

const MAX_TOKENS = 400
const FEEDBACK_TIMEOUT_MS = 6000
const MAX_POLISHED_GOAL_LENGTH = 20
const CACHE_TTL_SECONDS = 60 * 5
const STORE_TTL_SECONDS = 60 * 60 * 24

type CachedFeedback = {
    response: FeedbackResponse
    cachedAt: number
    clientId: string
}

type StoredSession = {
    clientId: string
    payload: FeedbackRequest
    createdAt: number
}

const responseCache = new Map<string, { value: CachedFeedback; expiresAt: number }>()
const sessionStore = new Map<string, { value: StoredSession; expiresAt: number }>()

async function loadCachedResponse(c: { env: Bindings }, key: string): Promise<CachedFeedback | null> {
    if (c.env.FEEDBACK_KV) {
        const stored = await c.env.FEEDBACK_KV.get(key)
        if (!stored) return null
        try {
            return JSON.parse(stored) as CachedFeedback
        } catch {
            logWarn('feedback_cache_json_parse_error', { key })
            return null
        }
    }

    const record = responseCache.get(key)
    if (!record) return null
    if (record.expiresAt < Date.now()) {
        responseCache.delete(key)
        return null
    }
    return record.value
}

async function saveCachedResponse(c: { env: Bindings }, key: string, response: FeedbackResponse, clientId: string): Promise<void> {
    const payload: CachedFeedback = { response, cachedAt: Date.now(), clientId }
    if (c.env.FEEDBACK_KV) {
        await c.env.FEEDBACK_KV.put(key, JSON.stringify(payload), { expirationTtl: CACHE_TTL_SECONDS })
        return
    }
    responseCache.set(key, { value: payload, expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000 })
}

async function loadStoredSession(c: { env: Bindings }, key: string): Promise<StoredSession | null> {
    if (c.env.FEEDBACK_KV) {
        const stored = await c.env.FEEDBACK_KV.get(key)
        if (!stored) return null
        try {
            return JSON.parse(stored) as StoredSession
        } catch {
            logWarn('feedback_session_json_parse_error', { key })
            return null
        }
    }

    const record = sessionStore.get(key)
    if (!record) return null
    if (record.expiresAt < Date.now()) {
        sessionStore.delete(key)
        return null
    }
    return record.value
}

async function saveStoredSession(c: { env: Bindings }, key: string, value: StoredSession): Promise<void> {
    if (c.env.FEEDBACK_KV) {
        await c.env.FEEDBACK_KV.put(key, JSON.stringify(value), { expirationTtl: STORE_TTL_SECONDS })
        return
    }
    sessionStore.set(key, { value, expiresAt: Date.now() + STORE_TTL_SECONDS * 1000 })
}

function sanitizeText(value: string): string {
    const trimmed = value.trim()
    const maskedEmail = trimmed.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    const maskedPhone = maskedEmail.replace(/\b0\d{1,4}-\d{1,4}-\d{3,4}\b/g, '[phone]')
    const maskedNumber = maskedPhone.replace(/\b\d{7,}\b/g, '[number]')
    return maskedNumber
}

function normalizeForCompare(value: string): string {
    return value
        .toLowerCase()
        .replace(/[\s、。・,._/()[\]{}「」『』"'-]/g, '')
}

function sanitizePayload(payload: FeedbackRequest): FeedbackRequest {
    const context = payload.context
        ? {
            work: payload.context.work ? sanitizeText(payload.context.work) : undefined,
            location: payload.context.location ? sanitizeText(payload.context.location) : undefined,
            weather: payload.context.weather ? sanitizeText(payload.context.weather) : undefined,
            processPhase: payload.context.processPhase ? sanitizeText(payload.context.processPhase) : undefined,
            healthCondition: payload.context.healthCondition ? sanitizeText(payload.context.healthCondition) : undefined,
        }
        : undefined

    const extracted = payload.extracted
        ? {
            risks: payload.extracted.risks?.map(sanitizeText),
            measures: payload.extracted.measures?.map(sanitizeText),
            actionGoal: payload.extracted.actionGoal ? sanitizeText(payload.extracted.actionGoal) : undefined,
        }
        : undefined

    return {
        sessionId: payload.sessionId,
        clientId: payload.clientId,
        context,
        extracted,
        chatDigest: payload.chatDigest ? sanitizeText(payload.chatDigest) : undefined,
    }
}

function buildFallbackResponse(requestId?: string) {
    return {
        praise: '今日のKYは要点が押さえられていて良い取り組みです。',
        tip: '次回は作業順序の確認を一言添えるとさらに良くなります。今の視点は十分に良いです。',
        supplements: [],
        polishedGoal: null,
        meta: {
            requestId,
            validationFallback: true,
        },
    }
}



feedback.post(
    '/',
    zValidator('json', FeedbackRequestSchema, (result, c) => {
        if (!result.success) {
            const requestId = (c as { get: (key: string) => string | undefined }).get('reqId')
            return c.json({
                error: {
                    code: 'INVALID_REQUEST',
                    message: 'Invalid feedback payload',
                    retriable: false,
                    requestId,
                }
            }, 400)
        }
    }),
    async (c) => {
        const reqId = c.get('reqId')

        if (c.env.ENABLE_FEEDBACK === '0') {
            return c.body(null, 204)
        }

        const apiKey = c.env.OPENAI_API_KEY
        if (!apiKey) {
            return c.json({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'OpenAI API key not configured',
                    retriable: false,
                    requestId: reqId,
                }
            }, 500)
        }

        const payload = c.req.valid('json')
        const storageKey = `feedback-session:${payload.sessionId}`

        let stored = await loadStoredSession(c, storageKey)
        if (stored && stored.clientId !== payload.clientId) {
            logWarn('feedback_owner_mismatch', { reqId })
            return c.body(null, 204)
        }

        if (!stored) {
            stored = {
                clientId: payload.clientId,
                payload: sanitizePayload(payload),
                createdAt: Date.now(),
            }
            await saveStoredSession(c, storageKey, stored)
        }

        const cacheKey = `feedback-cache:${payload.sessionId}`
        const cached = await loadCachedResponse(c, cacheKey)
        if (cached && cached.clientId === payload.clientId) {
            return c.json({
                ...cached.response,
                meta: {
                    ...(cached.response.meta ?? {}),
                    cached: true,
                    requestId: reqId,
                }
            })
        }

        const sanitized = stored.payload

        const userMessage = JSON.stringify({
            context: sanitized.context,
            extracted: sanitized.extracted,
            chatDigest: sanitized.chatDigest,
        })

        const requestBody = {
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: FEEDBACK_SYSTEM_PROMPT },
                { role: 'user', content: userMessage },
            ],
            max_tokens: MAX_TOKENS,
            temperature: 0.6,
            response_format: { type: 'json_object' },
        }

        try {
            const responseData = await fetchOpenAICompletion({
                apiKey,
                body: requestBody,
                timeoutMs: FEEDBACK_TIMEOUT_MS,
                reqId,
            })

            let parsed: unknown
            try {
                parsed = safeParseJSON(responseData.content)
            } catch {
                logWarn('feedback_json_parse_failed', { reqId })
                const fallback = buildFallbackResponse(reqId)
                return c.json(fallback)
            }

            const validation = FeedbackResponseSchema.safeParse(parsed)
            if (!validation.success) {
                logWarn('feedback_schema_validation_failed', { reqId })
                const fallback = buildFallbackResponse(reqId)
                return c.json(fallback)
            }

            const result = validation.data

            const existingItems = [
                ...(sanitized.extracted?.risks ?? []),
                ...(sanitized.extracted?.measures ?? []),
            ].map(normalizeForCompare)
            const filteredSupplements = result.supplements.filter((item) => {
                const riskNorm = normalizeForCompare(item.risk)
                const measureNorm = normalizeForCompare(item.measure)
                if (!riskNorm) return false
                return !existingItems.some((exist) => {
                    if (!exist) return false
                    if (exist.includes(riskNorm) || riskNorm.includes(exist)) return true
                    if (measureNorm && (exist.includes(measureNorm) || measureNorm.includes(exist))) return true
                    return false
                })
            })

            const dedupedSupplements: typeof result.supplements = []
            const seen = new Set<string>()
            for (const item of filteredSupplements) {
                const key = `${normalizeForCompare(item.risk)}:${normalizeForCompare(item.measure)}`
                if (seen.has(key)) continue
                seen.add(key)
                dedupedSupplements.push(item)
            }

            let polishedGoal = result.polishedGoal
            const originalGoal = sanitized.extracted?.actionGoal
            if (!originalGoal) {
                polishedGoal = null
            } else if (polishedGoal) {
                const polishedText = polishedGoal.polished.trim()
                const normalizedOriginal = normalizeForCompare(originalGoal)
                const normalizedPolished = normalizeForCompare(polishedText)
                if (
                    polishedText.length > MAX_POLISHED_GOAL_LENGTH ||
                    !/(ヨシ|よし|ﾖｼ)/.test(polishedText) ||
                    !normalizedPolished ||
                    normalizedPolished === normalizedOriginal
                ) {
                    polishedGoal = null
                } else {
                    polishedGoal = {
                        original: originalGoal,
                        polished: polishedText,
                    }
                }
            }

            const responseBody: FeedbackResponse = {
                ...result,
                supplements: dedupedSupplements.slice(0, 2),
                polishedGoal,
            }

            await saveCachedResponse(c, cacheKey, responseBody, payload.clientId)

            return c.json(responseBody)

        } catch (error) {
            if (error instanceof Error && error.message === 'TIMEOUT') {
                return c.json({
                    error: {
                        code: 'TIMEOUT',
                        message: 'AI応答がタイムアウトしました',
                        retriable: true,
                        requestId: reqId,
                    }
                }, 408)
            }
            if (error instanceof OpenAIHTTPErrorWithDetails) {
                // UX優先: フィードバックは必須ではないため、上流エラー時はフォールバックを返す。
                logWarn('feedback_openai_upstream_error', {
                    reqId,
                    status: error.status,
                    upstreamCode: error.upstreamCode,
                    upstreamType: error.upstreamType,
                })
                const fallback = buildFallbackResponse(reqId)
                return c.json(fallback)
            }
            logError('feedback_processing_error', { reqId })
            return c.json({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'システムエラーが発生しました',
                    retriable: false,
                    requestId: reqId,
                }
            }, 500)
        }
    }
)

export { feedback }
