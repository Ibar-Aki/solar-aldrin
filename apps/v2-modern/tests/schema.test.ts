
import { describe, it, expect } from 'vitest'
import { ChatMessageSchema } from '../src/lib/schema'

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
})
