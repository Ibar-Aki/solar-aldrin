import { logError, logWarn } from '../observability/logger'

interface OpenAIRequestOptions {
    apiKey: string
    body: unknown
    timeoutMs?: number
    reqId: string
    retryCount?: number
}

interface OpenAIResponse {
    content: string
    usage?: {
        total_tokens: number
    }
}

const DEFAULT_TIMEOUT = 10000
const MAX_RETRIES = 1

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

/**
 * OpenAI APIを呼び出し、JSONパース（Markdown除去含む）を実行する
 */
export async function fetchOpenAICompletion(options: OpenAIRequestOptions): Promise<OpenAIResponse> {
    const { apiKey, body, timeoutMs = DEFAULT_TIMEOUT, reqId, retryCount = MAX_RETRIES } = options

    const performRequest = async (currentRetry: number): Promise<Response> => {
        try {
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
                logWarn('openai_retry', { reqId, status: response.status })
                return performRequest(currentRetry - 1)
            }

            return response
        } catch (error) {
            // Retry on timeout/network error
            if (currentRetry > 0) {
                logWarn('openai_network_retry', { reqId, error: String(error) })
                return performRequest(currentRetry - 1)
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
        const errorText = await response.text()
        logError('openai_api_error', {
            reqId,
            status: response.status,
            body: errorText.slice(0, 500),
        })
        const error = new Error(`OpenAI API Error: ${response.status}`)
        // @ts-ignore
        error.status = response.status
        throw error
    }

    const data = await response.json() as {
        choices: Array<{ message: { content: string } }>
        usage?: { total_tokens: number }
    }

    const rawContent = data.choices[0]?.message?.content || '{}'
    const cleanContent = cleanJsonMarkdown(rawContent)

    return {
        content: cleanContent,
        usage: data.usage
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
        let clean = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '')

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
    } catch (e) {
        throw new Error('JSON_PARSE_FAILED')
    }
}
