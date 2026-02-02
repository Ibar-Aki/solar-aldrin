
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
export const USER_CONTENT_MAX_LENGTH = 1000
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

/** チャット成功レスポンスのスキーマ */
export const ChatSuccessResponseSchema = z.object({
    reply: z.string(),
    extracted: ExtractedDataSchema.optional(),
    usage: z.object({
        totalTokens: z.number(),
    }).optional(),
})

/** チャットエラーレスポンスのスキーマ */
export const ChatErrorResponseSchema = z.object({
    error: z.string(),
})

/** チャットレスポンスのスキーマ（成功 OR エラー） */
export const ChatResponseSchema = ChatSuccessResponseSchema.or(ChatErrorResponseSchema)

export type ChatRequest = z.infer<typeof ChatRequestSchema>
export type ChatSuccessResponse = z.infer<typeof ChatSuccessResponseSchema>
export type ChatErrorResponse = z.infer<typeof ChatErrorResponseSchema>
export type ChatResponse = z.infer<typeof ChatResponseSchema>

