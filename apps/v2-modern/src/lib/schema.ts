
import { z } from 'zod'
import { ExtractedDataSchema } from '@/lib/kySchemas'

function hasInvalidControlChars(value: string): boolean {
    for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i)
        if (code === 0x7f) return true
        if (code < 0x20 && code !== 0x0a && code !== 0x09) {
            return true
        }
    }
    return false
}

/** チャットメッセージのスキーマ */
const USER_CONTENT_MAX_LENGTH = 1000
const ASSISTANT_CONTENT_MAX_LENGTH = 3000
const contentSchema = (max: number) => z.string().max(max)
    .refine(val => !hasInvalidControlChars(val), {
        message: "制御文字が含まれています"
    })

export const ChatMessageSchema = z.discriminatedUnion('role', [
    z.object({
        role: z.literal('user'), // SEC-03: systemロールを禁止
        content: contentSchema(USER_CONTENT_MAX_LENGTH), // ユーザー入力のみ制限
    }),
    z.object({
        role: z.literal('assistant'), // SEC-03: systemロールを禁止
        content: contentSchema(ASSISTANT_CONTENT_MAX_LENGTH),
    }),
])

/** セッションコンテキストのスキーマ */
export const SessionContextSchema = z.object({
    userName: z.string(),
    siteName: z.string(),
    weather: z.string(),
    workItemCount: z.number(),
})

/** チャットリクエストのスキーマ */
export const ChatRequestSchema = z.object({
    messages: z.array(ChatMessageSchema).min(1),
    sessionContext: SessionContextSchema.optional(),
})

/** チャットレスポンスのスキーマ */
export const ChatResponseSchema = z.object({
    reply: z.string(),
    extracted: ExtractedDataSchema,
    usage: z.object({
        totalTokens: z.number(),
    }),
}).or(z.object({
    error: z.string(),
}))

export type ChatRequest = z.infer<typeof ChatRequestSchema>
export type ChatResponse = z.infer<typeof ChatResponseSchema>
