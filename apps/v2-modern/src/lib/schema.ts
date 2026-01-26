
import { z } from 'zod'

/** チャットメッセージのスキーマ */
export const ChatMessageSchema = z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
})

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
    usage: z.object({
        totalTokens: z.number(),
    }),
}).or(z.object({
    error: z.string(),
}))

/** データ抽出リクエストのスキーマ */
export const ExtractionRequestSchema = z.object({
    conversation: z.string().min(1),
})

/** データ抽出レスポンスのスキーマ */
export const ExtractionResponseSchema = z.object({
    extracted: z.record(z.string(), z.any()),
    warning: z.string().optional(),
}).or(z.object({
    error: z.string(),
}))

export type ChatRequest = z.infer<typeof ChatRequestSchema>
export type ChatResponse = z.infer<typeof ChatResponseSchema>
export type ExtractionRequest = z.infer<typeof ExtractionRequestSchema>
export type ExtractionResponse = z.infer<typeof ExtractionResponseSchema>
