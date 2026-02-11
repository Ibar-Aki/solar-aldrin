import { describe, expect, it } from 'vitest'
import { cleanJsonMarkdown, safeParseJSON } from '../../workers/lib/openai'

describe('openai json cleanup', () => {
    it('extracts JSON from fenced code blocks', () => {
        const input = '```json\n{"ok":true}\n```'
        expect(cleanJsonMarkdown(input)).toBe('{"ok":true}')
    })

    it('extracts JSON from embedded fenced blocks with prose', () => {
        const input = 'Result below:\n```JSON\n{"n":1}\n```\nThanks.'
        expect(cleanJsonMarkdown(input)).toBe('{"n":1}')
    })

    it('safeParseJSON handles BOM + fenced JSON', () => {
        const parsed = safeParseJSON<{ value: string }>('\uFEFF```json\n{"value":"x"}\n```')
        expect(parsed).toEqual({ value: 'x' })
    })
})
