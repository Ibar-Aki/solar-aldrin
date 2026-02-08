
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
const CONTEXT_FIELD_MAX_LENGTH = 120
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
    userName: contentSchema(80),
    siteName: contentSchema(CONTEXT_FIELD_MAX_LENGTH),
    weather: contentSchema(60),
    workItemCount: z.number().int().min(0).max(1000),
    processPhase: contentSchema(80).optional(),
    healthCondition: contentSchema(80).optional(),
})

/** チャットリクエストのスキーマ */
export const ChatRequestSchema = z.object({
    messages: z.array(ChatMessageSchema).min(1),
    sessionContext: SessionContextSchema.optional(),
    contextInjection: contentSchema(1200).optional(),
    conversationSummary: contentSchema(1200).optional(),
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
    // Backend may include these even when it responds with 2xx (e.g. via proxying layers).
    code: z.string().optional(),
    requestId: z.string().optional(),
    retriable: z.boolean().optional(),
    details: z.unknown().optional(),
})

/** チャットレスポンスのスキーマ（成功 OR エラー） */
export const ChatResponseSchema = ChatSuccessResponseSchema.or(ChatErrorResponseSchema)

export type ChatRequest = z.infer<typeof ChatRequestSchema>
export type ChatSuccessResponse = z.infer<typeof ChatSuccessResponseSchema>
export type ChatErrorResponse = z.infer<typeof ChatErrorResponseSchema>
export type ChatResponse = z.infer<typeof ChatResponseSchema>

/** フィードバックAPIのリクエストスキーマ */
export const FeedbackRequestSchema = z.object({
    sessionId: z.string().min(8).max(128),
    clientId: z.string().min(8).max(128),
    context: z.object({
        work: z.string().max(200).optional(),
        location: z.string().max(200).optional(),
        weather: z.string().max(100).optional(),
        processPhase: z.string().max(80).optional(),
        healthCondition: z.string().max(80).optional(),
    }).optional(),
    extracted: z.object({
        risks: z.array(z.string().max(120)).max(20).optional(),
        measures: z.array(z.string().max(120)).max(20).optional(),
        actionGoal: z.string().max(120).optional(),
    }).optional(),
    chatDigest: z.string().max(1200).optional(),
}).strict()

/** フィードバックAPIの成功レスポンススキーマ */
export const FeedbackResponseSchema = z.object({
    praise: z.string().min(1).max(240),
    tip: z.string().min(1).max(240),
    supplements: z.array(z.object({
        risk: z.string().min(1).max(120),
        measure: z.string().min(1).max(120),
    })).max(2),
    polishedGoal: z.object({
        original: z.string().min(1).max(120),
        polished: z.string().min(1).max(120),
    }).nullable(),
    meta: z.object({
        requestId: z.string().min(6).max(64).optional(),
        cached: z.boolean().optional(),
        validationFallback: z.boolean().optional(),
    }).optional(),
})

/** フィードバックAPIのエラーレスポンススキーマ */
export const FeedbackErrorResponseSchema = z.object({
    error: z.object({
        code: z.string(),
        message: z.string(),
        retriable: z.boolean().optional(),
        requestId: z.string().optional(),
    }),
})

/** フィードバックAPIのレスポンススキーマ（成功 OR エラー） */
export const FeedbackApiResponseSchema = FeedbackResponseSchema.or(FeedbackErrorResponseSchema)

export type FeedbackRequest = z.infer<typeof FeedbackRequestSchema>
export type FeedbackResponse = z.infer<typeof FeedbackResponseSchema>
export type FeedbackErrorResponse = z.infer<typeof FeedbackErrorResponseSchema>
export type FeedbackApiResponse = z.infer<typeof FeedbackApiResponseSchema>

