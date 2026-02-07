import { describe, expect, it } from 'vitest'
import { getSpeechRecognitionErrorMessage, normalizeSpeechRecognitionError } from '@/lib/speechRecognitionErrors'

describe('speechRecognitionErrors', () => {
    it('normalizeSpeechRecognitionError: "service not allowed" を service-not-allowed に正規化する', () => {
        expect(normalizeSpeechRecognitionError('service not allowed')).toBe('service-not-allowed')
    })

    it('getSpeechRecognitionErrorMessage: service-not-allowed は短い文言になる', () => {
        expect(getSpeechRecognitionErrorMessage('service-not-allowed')).toBe('この環境では音声認識が利用できません')
    })
})

