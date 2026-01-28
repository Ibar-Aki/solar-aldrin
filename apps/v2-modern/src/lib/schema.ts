
import { z } from 'zod'

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

/** AI抽出データのスキーマ（APIレスポンス用） */
export const ExtractedDataSchema = z.object({
    workDescription: z.string().nullable().optional(),
    hazardDescription: z.string().nullable().optional(),
    riskLevel: z.number().min(1).max(5).nullable().optional(),
    whyDangerous: z.array(z.string()).optional(),
    countermeasures: z.array(z.string()).optional(),
    actionGoal: z.string().nullable().optional(),
    nextAction: z.enum([
        'ask_work',
        'ask_hazard',
        'ask_why',
        'ask_countermeasure',
        'ask_risk_level',
        'ask_more_work',
        'ask_goal',
        'confirm',
        'completed',
    ]).optional(),
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
