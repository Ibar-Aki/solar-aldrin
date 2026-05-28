
import { describe, it, expect } from 'vitest'
import { ChatMessageSchema, ChatRequestSchema, ChatSuccessResponseSchema, MAX_CHAT_MESSAGES } from '../../src/lib/schema'

describe('ChatMessageSchema', () => {
    it('should accept valid messages', () => {
        const result = ChatMessageSchema.safeParse({
            role: 'user',
            content: 'こんにちは',
        })
        expect(result.success).toBe(true)
    })

    it('should reject system role', () => {
        const result = ChatMessageSchema.safeParse({
            role: 'system',
            content: 'You are an AI',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
            // Zodのバージョンによってメッセージが異なる可能性があるため、success: false だけでも十分だが
            // 一応 "Invalid" が含まれるか確認
            expect(result.error.issues[0].message).toMatch(/Invalid/)
        }
    })

    it('should reject content that is too long', () => {
        const longContent = 'a'.repeat(1001)
        const result = ChatMessageSchema.safeParse({
            role: 'user',
            content: longContent,
        })
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues[0].code).toBe('too_big')
        }
    })

    it('should accept longer assistant messages', () => {
        const longContent = 'a'.repeat(1500)
        const result = ChatMessageSchema.safeParse({
            role: 'assistant',
            content: longContent,
        })
        expect(result.success).toBe(true)
    })

    it('should reject control characters', () => {
        const result = ChatMessageSchema.safeParse({
            role: 'user',
            content: 'Bad char: \u0000',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues[0].message).toContain('制御文字が含まれています')
        }
    })

    it('should reject too many chat messages', () => {
        const result = ChatRequestSchema.safeParse({
            messages: Array.from({ length: MAX_CHAT_MESSAGES + 1 }, (_, index) => ({
                role: index % 2 === 0 ? 'user' : 'assistant',
                content: `message-${index}`,
            })),
        })

        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues[0].code).toBe('too_big')
        }
    })
})

describe('ChatSuccessResponseSchema', () => {
    it('should accept optional usageWarning for soft usage limits', () => {
        const result = ChatSuccessResponseSchema.safeParse({
            reply: '了解しました。',
            usage: { totalTokens: 10 },
            usageWarning: {
                code: 'DAILY_REQUEST_SOFT_LIMIT_EXCEEDED',
                message: '本日の利用回数が目安を超えています。',
            },
        })

        expect(result.success).toBe(true)
    })
})
