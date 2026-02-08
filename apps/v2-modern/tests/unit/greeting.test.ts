import { describe, it, expect } from 'vitest'
import { getTimeGreeting } from '../../src/lib/greeting'

describe('getTimeGreeting', () => {
    it('should return おはようございます！ between 05-11', () => {
        expect(getTimeGreeting(new Date(2020, 0, 1, 5, 0, 0))).toBe('おはようございます！')
        expect(getTimeGreeting(new Date(2020, 0, 1, 11, 59, 59))).toBe('おはようございます！')
    })

    it('should return こんにちは！ between 12-17', () => {
        expect(getTimeGreeting(new Date(2020, 0, 1, 12, 0, 0))).toBe('こんにちは！')
        expect(getTimeGreeting(new Date(2020, 0, 1, 17, 59, 59))).toBe('こんにちは！')
    })

    it('should return こんばんは！ between 18-04', () => {
        expect(getTimeGreeting(new Date(2020, 0, 1, 18, 0, 0))).toBe('こんばんは！')
        expect(getTimeGreeting(new Date(2020, 0, 1, 23, 59, 59))).toBe('こんばんは！')
        expect(getTimeGreeting(new Date(2020, 0, 1, 0, 0, 0))).toBe('こんばんは！')
        expect(getTimeGreeting(new Date(2020, 0, 1, 4, 59, 59))).toBe('こんばんは！')
    })
})

