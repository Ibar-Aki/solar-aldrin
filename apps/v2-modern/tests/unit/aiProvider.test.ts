import { describe, expect, it } from 'vitest'
import {
    DEFAULT_AI_MODELS,
    resolveAIProvider,
    resolveModelByProvider,
    resolveProviderApiKey,
} from '../../workers/lib/aiProvider'

describe('aiProvider helpers', () => {
    it('AI_PROVIDER が gemini の場合は gemini を返し、それ以外は openai を返す', () => {
        expect(resolveAIProvider('gemini')).toBe('gemini')
        expect(resolveAIProvider('  GeMiNi  ')).toBe('gemini')
        expect(resolveAIProvider('openai')).toBe('openai')
        expect(resolveAIProvider(undefined)).toBe('openai')
        expect(resolveAIProvider('unknown')).toBe('openai')
    })

    it('provider に応じた API キーを返す', () => {
        const env = {
            GEMINI_API_KEY: '  gem-key  ',
            OPENAI_API_KEY: '  oa-key  ',
        }
        expect(resolveProviderApiKey('gemini', env)).toBe('gem-key')
        expect(resolveProviderApiKey('openai', env)).toBe('oa-key')
        expect(resolveProviderApiKey('gemini', { OPENAI_API_KEY: 'x' })).toBeUndefined()
    })

    it('AI_MODEL がある場合は provider に関係なく優先する', () => {
        const env = {
            AI_MODEL: ' common-model ',
            GEMINI_MODEL: 'gemini-model',
            OPENAI_MODEL: 'openai-model',
        }
        expect(resolveModelByProvider('gemini', env, DEFAULT_AI_MODELS)).toBe('common-model')
        expect(resolveModelByProvider('openai', env, DEFAULT_AI_MODELS)).toBe('common-model')
    })

    it('AI_MODEL 未設定時は provider 別のモデル設定と既定値へフォールバックする', () => {
        expect(resolveModelByProvider('gemini', { GEMINI_MODEL: ' gemini-model ' }, DEFAULT_AI_MODELS)).toBe('gemini-model')
        expect(resolveModelByProvider('openai', { OPENAI_MODEL: ' openai-model ' }, DEFAULT_AI_MODELS)).toBe('openai-model')
        expect(resolveModelByProvider('gemini', {}, DEFAULT_AI_MODELS)).toBe('gemini-2.5-flash')
        expect(resolveModelByProvider('openai', {}, DEFAULT_AI_MODELS)).toBe('gpt-4o-mini')
    })
})
