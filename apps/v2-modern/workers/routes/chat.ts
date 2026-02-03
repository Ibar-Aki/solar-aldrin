/**
 * チャットAPIルート
 * OpenAI GPT-4o mini を使用
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { SOLO_KY_SYSTEM_PROMPT } from '../prompts/soloKY'
import { ChatRequestSchema, ChatSuccessResponseSchema, USER_CONTENT_MAX_LENGTH } from '../../src/lib/schema'
import type { ExtractedData } from '../../src/types/ky'
import { logError, logWarn } from '../observability/logger'
import { fetchOpenAICompletion, safeParseJSON } from '../lib/openai'

type Bindings = {
    OPENAI_API_KEY: string
    ENABLE_CONTEXT_INJECTION?: string
}

const chat = new Hono<{
    Bindings: Bindings
    Variables: {
        reqId: string
    }
}>()

// 最大会話履歴数
const MAX_HISTORY_TURNS = 10
// 最大合計入力文字数 (ユーザー入力単体は1000文字、履歴含めて余裕を持たせる)
const MAX_TOTAL_INPUT_LENGTH = USER_CONTENT_MAX_LENGTH * 10
// 最大出力トークン数
const MAX_TOKENS = 1000 // JSON出力のため少し増やす
// 禁止語（最小セット）
const BANNED_WORDS = ['殺す', '死ね', '爆弾', 'テロ']

function hasBannedWord(text: string): boolean {
    return BANNED_WORDS.some(word => text.includes(word))
}

/**
 * POST /api/chat
 * AIとの対話 (Returns JSON with reply and extraction)
 */
chat.post('/', zValidator('json', ChatRequestSchema, (result, c) => {
    if (!result.success) {
        // Fix: Use result.error directly, or cast if flatten doesn't exist on the type at runtime/build time appropriately
        // For Hono zValidator, the error is usually a ZodError. 
        // We will just return result.error for safety as instructed by self-review.
        return c.json({ error: 'Validation Error', details: result.error }, 400)
    }
}), async (c) => {
    const apiKey = c.env.OPENAI_API_KEY
    if (!apiKey) {
        return c.json({ error: 'OpenAI API key not configured' }, 500)
    }

    const { messages, sessionContext, contextInjection } = c.req.valid('json')

    // 入力検証（禁止語・文字数制限）
    let totalLength = 0
    for (const msg of messages) {
        totalLength += msg.content.length
        if (msg.role === 'user' && hasBannedWord(msg.content)) {
            return c.json({ error: '禁止語が含まれています' }, 400)
        }
    }

    if (totalLength > MAX_TOTAL_INPUT_LENGTH) {
        return c.json({ error: `メッセージ全体の合計が${MAX_TOTAL_INPUT_LENGTH}文字を超えています（現在: ${totalLength}文字）` }, 400)
    }

    // 会話履歴を制限
    const limitedHistory = messages.slice(-MAX_HISTORY_TURNS * 2)

    // システムプロンプトの構築
    let systemPrompt = SOLO_KY_SYSTEM_PROMPT
    const contextEnabled = c.env.ENABLE_CONTEXT_INJECTION !== '0'
    if (contextEnabled && contextInjection) {
        systemPrompt += `\n\n## 追加コンテキスト\n${contextInjection}`
    }

    if (sessionContext) {
        systemPrompt += `\n\n## 現在のセッション情報
- 作業者: ${sessionContext.userName}
- 現場: ${sessionContext.siteName}
- 天候: ${sessionContext.weather}
- 登録済み作業数: ${sessionContext.workItemCount}件`
        if (sessionContext.processPhase) {
            systemPrompt += `\n- 工程: ${sessionContext.processPhase}`
        }
        if (sessionContext.healthCondition) {
            systemPrompt += `\n- 体調: ${sessionContext.healthCondition}`
        }
    }

    try {
        const responseData = await fetchOpenAICompletion({
            apiKey,
            body: {
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...limitedHistory,
                ],
                max_tokens: MAX_TOKENS,
                temperature: 0.7,
                response_format: { type: 'json_object' },
            },
            reqId: c.get('reqId'),
        })

        let parsedContent: { reply?: string; extracted?: ExtractedData } = {}

        try {
            parsedContent = safeParseJSON(responseData.content)
        } catch {
            logError('json_parse_retry_failed', { reqId: c.get('reqId') })
            // Fallback for malformed JSON
            parsedContent = {
                reply: '申し訳ありません、システムの内部エラーが発生しました。もう一度お試しください。',
                extracted: {}
            }
        }

        // --- Zodによる構造検証 ---
        // usageは後で付与するため除外して検証
        const validationResult = ChatSuccessResponseSchema.omit({ usage: true }).safeParse(parsedContent)

        if (!validationResult.success) {
            logError('response_schema_validation_error', { reqId: c.get('reqId') })
            return c.json({
                error: 'AIからの応答が不正な形式です。再試行してください。',
                details: validationResult.error
            }, 502)
        }

        const validContent = validationResult.data

        return c.json({
            reply: validContent.reply,
            extracted: validContent.extracted || {},
            usage: {
                totalTokens: responseData.usage?.total_tokens || 0,
            },
        })

    } catch (error) {
        if (error instanceof Error && error.message === 'TIMEOUT') {
            return c.json({ error: 'AI応答がタイムアウトしました', retriable: true }, 504)
        }

        // @ts-ignore
        if (error.status === 429 || error.status >= 500) {
            // @ts-ignore
            return c.json({ error: 'AIサービスが混雑しています', retriable: true }, error.status)
        }

        const message = error instanceof Error ? error.message : 'unknown_error'
        logError('chat_processing_error', {
            reqId: c.get('reqId'),
            message,
        })
        return c.json({ error: 'システムエラーが発生しました' }, 500)
    }
})

export { chat }
