export type AIProvider = 'openai' | 'gemini'

export type AIProviderEnv = {
    AI_MODEL?: string
    GEMINI_MODEL?: string
    OPENAI_MODEL?: string
    GEMINI_API_KEY?: string
    OPENAI_API_KEY?: string
}

export const DEFAULT_AI_MODELS = {
    gemini: 'gemini-2.5-flash',
    openai: 'gpt-4o-mini',
} as const

export function resolveAIProvider(raw: string | undefined): AIProvider {
    return raw?.trim().toLowerCase() === 'gemini' ? 'gemini' : 'openai'
}

export function resolveProviderApiKey(provider: AIProvider, env: AIProviderEnv): string | undefined {
    if (provider === 'gemini') return env.GEMINI_API_KEY?.trim() || undefined
    return env.OPENAI_API_KEY?.trim() || undefined
}

export function resolveModelByProvider(
    provider: AIProvider,
    env: AIProviderEnv,
    defaults: { gemini: string; openai: string } = DEFAULT_AI_MODELS
): string {
    const common = env.AI_MODEL?.trim()
    if (common) return common
    if (provider === 'gemini') return env.GEMINI_MODEL?.trim() || defaults.gemini
    return env.OPENAI_MODEL?.trim() || defaults.openai
}
