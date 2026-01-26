/**
 * チャットAPIルート
 * OpenAI GPT-4o mini を使用
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { SOLO_KY_SYSTEM_PROMPT, EXTRACTION_PROMPT } from '../prompts/soloKY'
import { ChatRequestSchema, ExtractionRequestSchema } from '../../src/lib/schema'

type Bindings = {
    OPENAI_API_KEY: string
}

const chat = new Hono<{ Bindings: Bindings }>()

// 最大会話履歴数
const MAX_HISTORY_TURNS = 10
// 最大入力文字数
const MAX_INPUT_LENGTH = 3000
// 最大出力トークン数
const MAX_TOKENS = 500

/**
 * POST /api/chat
 * AIとの対話
 */
chat.post('/', zValidator('json', ChatRequestSchema, (result, c) => {
    if (!result.success) {
        return c.json({ error: 'Validation Error', details: result.error as any }, 400)
    }
}), async (c) => {
    const apiKey = c.env.OPENAI_API_KEY
    if (!apiKey) {
        return c.json({ error: 'OpenAI API key not configured' }, 500)
    }

    const { messages, sessionContext } = c.req.valid('json')

    // 入力サニタイズ（Systemロールの無効化と文字数制限）
    let totalLength = 0
    const cleanMessages = messages.map(msg => {
        totalLength += msg.content.length
        if (msg.role === 'system') {
            return { ...msg, role: 'user' as const } // Systemロールはユーザーとして扱う
        }
        return msg
    })

    if (totalLength > MAX_INPUT_LENGTH) {
        return c.json({ error: `メッセージ全体の合計が${MAX_INPUT_LENGTH}文字を超えています（現在: ${totalLength}文字）` }, 400)
    }

    // 会話履歴を制限
    const limitedHistory = cleanMessages.slice(-MAX_HISTORY_TURNS * 2)

    // システムプロンプトの構築
    let systemPrompt = SOLO_KY_SYSTEM_PROMPT
    if (sessionContext) {
        systemPrompt += `\n\n## 現在のセッション情報
- 作業者: ${sessionContext.userName}
- 現場: ${sessionContext.siteName}
- 天候: ${sessionContext.weather}
- 登録済み作業数: ${sessionContext.workItemCount}件`
    }

    try {
        // OpenAI API呼び出し
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...limitedHistory,
                ],
                max_tokens: MAX_TOKENS,
                temperature: 0.7,
            }),
        })

        if (!response.ok) {
            const error = await response.text()
            console.error('OpenAI API error:', error)
            return c.json({ error: 'AI応答の取得に失敗しました' }, 502)
        }

        const data = await response.json() as {
            choices: Array<{
                message: { content: string }
            }>
            usage?: {
                total_tokens: number
            }
        }

        const reply = data.choices[0]?.message?.content || ''
        const usage = data.usage

        return c.json({
            reply,
            usage: {
                totalTokens: usage?.total_tokens || 0,
            },
        })

    } catch (e) {
        console.error('Chat API error:', e)
        return c.json({ error: 'AI応答の取得に失敗しました' }, 500)
    }
})

/**
 * POST /api/chat/extract
 * 会話からKYデータを抽出
 */
chat.post('/extract', zValidator('json', ExtractionRequestSchema), async (c) => {
    const apiKey = c.env.OPENAI_API_KEY
    if (!apiKey) {
        return c.json({ error: 'OpenAI API key not configured' }, 500)
    }

    const { conversation } = c.req.valid('json')

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: EXTRACTION_PROMPT },
                    { role: 'user', content: conversation },
                ],
                max_tokens: MAX_TOKENS,
                temperature: 0,
                response_format: { type: 'json_object' },
            }),
        })

        if (!response.ok) {
            const error = await response.text()
            console.error('OpenAI extraction error:', error)
            return c.json({ error: 'データ抽出に失敗しました' }, 502)
        }

        const data = await response.json() as {
            choices: Array<{ message: { content: string } }>
        }

        const content = data.choices[0]?.message?.content || '{}'

        try {
            const extracted = JSON.parse(content)
            return c.json({ extracted })
        } catch {
            return c.json({ extracted: {}, warning: 'JSON parse failed' })
        }

    } catch (e) {
        console.error('Extraction error:', e)
        return c.json({ error: 'データ抽出に失敗しました' }, 500)
    }
})

export { chat }
