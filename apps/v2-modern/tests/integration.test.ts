import { describe, it, expect, vi, beforeEach } from 'vitest'
import { chat } from '../workers/routes/chat'

describe('Chat API Integration Flow', () => {
    beforeEach(() => {
        vi.resetAllMocks()
        global.fetch = vi.fn()
    })

    it('should process chat request and return structured JSON', async () => {
        // Mock OpenAI Response
        const mockOpenAIResponse = {
            choices: [{
                message: {
                    content: JSON.stringify({
                        reply: "はい、作業内容を教えてください。",
                        extracted: {
                            workDescription: "足場組立",
                            nextAction: "ask_hazard"
                        }
                    })
                }
            }],
            usage: { total_tokens: 100 }
        }

        // Setup fetch mock
        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: async () => mockOpenAIResponse,
            text: async () => ""
        } as Response)

        // Create request
        const req = new Request('http://localhost/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: '足場組立をします' }],
                sessionContext: {
                    userName: 'TestUser',
                    siteName: 'TestSite',
                    weather: 'Sunny',
                    workItemCount: 0
                }
            })
        })

        // Invoke Hono app
        const res = await chat.fetch(req, { OPENAI_API_KEY: 'mock-key' })

        expect(res.status).toBe(200)
        const body = await res.json()

        // Verify Structure
        expect(body).toHaveProperty('reply', 'はい、作業内容を教えてください。')
        expect(body).toHaveProperty('extracted')
        expect(body.extracted).toHaveProperty('workDescription', '足場組立')
        expect(body.extracted).toHaveProperty('nextAction', 'ask_hazard')
    })

    it('should handle malformed JSON from OpenAI gracefully', async () => {
        // Mock OpenAI Response with Bad JSON
        const mockOpenAIResponse = {
            choices: [{
                message: {
                    content: "This is not JSON"
                }
            }],
            usage: { total_tokens: 50 }
        }

        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: async () => mockOpenAIResponse,
            text: async () => ""
        } as Response)

        const req = new Request('http://localhost/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: 'Hello' }]
            })
        })

        const res = await chat.fetch(req, { OPENAI_API_KEY: 'mock-key' })

        expect(res.status).toBe(200)
        const body = await res.json() as {
            reply: string
            extracted: Record<string, unknown>
        }

        // Should return fallback error message but successful 200 OK for the client
        expect(body.reply).toContain('申し訳ありません')
        expect(body.extracted).toEqual({})
    })
})
