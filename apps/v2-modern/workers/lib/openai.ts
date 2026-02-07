import { logError, logWarn } from '../observability/logger'

interface OpenAIRequestOptions {
    apiKey: string
    body: unknown
    timeoutMs?: number
    reqId: string
    retryCount?: number
}

export type OpenAIResponseMeta = {
    httpAttempts: number
    httpRetries: number
    durationMs: number
}

interface OpenAIResponse {
    content: string
    usage?: {
        total_tokens: number
    }
    meta: OpenAIResponseMeta
}

const DEFAULT_TIMEOUT = 30000
const MAX_RETRIES = 2
const BACKOFF_BASE_MS = 250
const BACKOFF_MAX_MS = 700

function getRetryDelayMs(attempt: number): number {
    const baseDelay = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * (2 ** attempt))
    const jitter = Math.floor(Math.random() * 120)
    return baseDelay + jitter
}

async function sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
        const response = await fetch(input, { ...init, signal: controller.signal })
        return response
    } finally {
        clearTimeout(timeout)
    }
}

type OpenAIErrorPayload = {
    error?: {
        message?: string
        type?: string
        code?: string
        param?: string
    }
}

export type OpenAIHTTPErrorDetails = {
    status: number
    retryAfterSec?: number
    upstreamMessage?: string
    upstreamType?: string
    upstreamCode?: string
    upstreamParam?: string
    bodySnippet?: string
}

export class OpenAIHTTPErrorWithDetails extends Error {
    status: number
    retryAfterSec?: number
    upstreamMessage?: string
    upstreamType?: string
    upstreamCode?: string
    upstreamParam?: string
    bodySnippet?: string

    constructor(message: string, details: OpenAIHTTPErrorDetails) {
        super(message)
        this.name = 'OpenAIHTTPError'
        this.status = details.status
        this.retryAfterSec = details.retryAfterSec
        this.upstreamMessage = details.upstreamMessage
        this.upstreamType = details.upstreamType
        this.upstreamCode = details.upstreamCode
        this.upstreamParam = details.upstreamParam
        this.bodySnippet = details.bodySnippet
    }
}

/**
 * OpenAI APIを呼び出し、JSONパース（Markdown除去含む）を実行する
 */
export async function fetchOpenAICompletion(options: OpenAIRequestOptions): Promise<OpenAIResponse> {
    const { apiKey, body, timeoutMs = DEFAULT_TIMEOUT, reqId, retryCount = MAX_RETRIES } = options

    const startedAt = Date.now()
    let httpAttempts = 0

    const performRequest = async (currentRetry: number, attempt: number = 0): Promise<Response> => {
        try {
            httpAttempts += 1
            const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify(body),
            }, timeoutMs)

            // Retryable errors (5xx, 429)
            if (!response.ok && (response.status >= 500 || response.status === 429) && currentRetry > 0) {
                const delayMs = getRetryDelayMs(attempt)
                logWarn('openai_retry', { reqId, status: response.status, delayMs, attempt: attempt + 1 })
                await sleep(delayMs)
                return performRequest(currentRetry - 1, attempt + 1)
            }

            return response
        } catch (error) {
            // Retry on timeout/network error
            if (currentRetry > 0) {
                const delayMs = getRetryDelayMs(attempt)
                logWarn('openai_network_retry', { reqId, error: String(error), delayMs, attempt: attempt + 1 })
                await sleep(delayMs)
                return performRequest(currentRetry - 1, attempt + 1)
            }
            throw error
        }
    }

    let response: Response
    try {
        response = await performRequest(retryCount)
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('TIMEOUT')
        }
        throw error
    }

    if (!response.ok) {
        const retryAfterRaw = response.headers.get('retry-after')
        const retryAfterParsed = retryAfterRaw ? Number.parseInt(retryAfterRaw, 10) : undefined
        const retryAfterSec = Number.isFinite(retryAfterParsed) ? retryAfterParsed : undefined

        const errorText = await response.text()
        const bodySnippet = errorText.slice(0, 500)

        let upstreamMessage: string | undefined
        let upstreamType: string | undefined
        let upstreamCode: string | undefined
        let upstreamParam: string | undefined
        try {
            const parsed = JSON.parse(errorText) as OpenAIErrorPayload
            upstreamMessage = parsed.error?.message
            upstreamType = parsed.error?.type
            upstreamCode = parsed.error?.code
            upstreamParam = parsed.error?.param
        } catch {
            // ignore json parse
        }

        logError('openai_api_error', {
            reqId,
            status: response.status,
            body: bodySnippet,
        })

        const composedMessage = upstreamMessage
            ? `OpenAI API Error: ${response.status} (${upstreamMessage.slice(0, 200)})`
            : `OpenAI API Error: ${response.status}`

        // Throw a typed error so routes can map it into user-visible, non-leaky messages.
        throw new OpenAIHTTPErrorWithDetails(composedMessage, {
            status: response.status,
            retryAfterSec,
            upstreamMessage,
            upstreamType,
            upstreamCode,
            upstreamParam,
            bodySnippet,
        })
    }

    const data = await response.json() as {
        choices: Array<{ message: { content: string } }>
        usage?: { total_tokens: number }
    }

    const rawContent = data.choices[0]?.message?.content || '{}'
    const cleanContent = cleanJsonMarkdown(rawContent)

    return {
        content: cleanContent,
        usage: data.usage,
        meta: {
            httpAttempts,
            httpRetries: Math.max(0, httpAttempts - 1),
            durationMs: Date.now() - startedAt,
        },
    }
}

/**
 * Markdown記法 (```json ... ```) を除去し、JSON文字列を抽出する
 */
export function cleanJsonMarkdown(content: string): string {
    try {
        // まずそのままパースできるか試す
        JSON.parse(content)
        return content
    } catch {
        // Markdown記法の除去
        const clean = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '')

        // { ... } の範囲を抽出
        const firstBrace = clean.indexOf('{')
        const lastBrace = clean.lastIndexOf('}')

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            return clean.substring(firstBrace, lastBrace + 1)
        }

        // フォールバック: 元の文字列を返す（呼び出し元でパースエラーになる）
        return content
    }
}

/**
 * 安全にJSONパースを行う（パース失敗時は null ではなく Error を投げるか、呼び出し元で try-catch する前提）
 */
export function safeParseJSON<T>(content: string): T {
    const cleaned = cleanJsonMarkdown(content)
    try {
        return JSON.parse(cleaned) as T
    } catch {
        throw new Error('JSON_PARSE_FAILED')
    }
}
