import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchOpenAICompletion, OpenAIHTTPErrorWithDetails } from '../../workers/lib/openai'

describe('fetchOpenAICompletion - OpenAI HTTP errors', () => {
    const originalFetch = globalThis.fetch

    beforeEach(() => {
        vi.restoreAllMocks()
    })

    afterEach(() => {
        globalThis.fetch = originalFetch
    })

    it('throws OpenAIHTTPErrorWithDetails with upstream message on 400', async () => {
        globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
            error: {
                message: 'The model `gpt-xxx` does not exist',
                type: 'invalid_request_error',
                code: 'model_not_found',
                param: 'model',
            },
        }), {
            status: 400,
            headers: { 'content-type': 'application/json' },
        })) as unknown as typeof fetch

        await expect(fetchOpenAICompletion({
            apiKey: 'sk-test',
            reqId: 'req_test',
            body: { model: 'gpt-xxx', messages: [] },
            timeoutMs: 1000,
            retryCount: 0,
        })).rejects.toMatchObject({
            name: 'OpenAIHTTPError',
            status: 400,
            upstreamMessage: expect.stringContaining('does not exist'),
            upstreamCode: 'model_not_found',
            upstreamType: 'invalid_request_error',
            upstreamParam: 'model',
        } satisfies Partial<OpenAIHTTPErrorWithDetails>)
    })

    it('passes through retry-after on 429', async () => {
        globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
            error: { message: 'Rate limit exceeded' },
        }), {
            status: 429,
            headers: { 'retry-after': '7', 'content-type': 'application/json' },
        })) as unknown as typeof fetch

        try {
            await fetchOpenAICompletion({
                apiKey: 'sk-test',
                reqId: 'req_test',
                body: { model: 'gpt-xxx', messages: [] },
                timeoutMs: 1000,
                retryCount: 0,
            })
            throw new Error('expected to throw')
        } catch (e) {
            expect(e).toBeInstanceOf(OpenAIHTTPErrorWithDetails)
            const err = e as OpenAIHTTPErrorWithDetails
            expect(err.status).toBe(429)
            expect(err.retryAfterSec).toBe(7)
        }
    })
})

