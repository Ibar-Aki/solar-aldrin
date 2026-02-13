import { OpenAIHTTPErrorWithDetails } from '../openai'
import { getProviderDisplayName } from './config'

export function getErrorStatus(error: unknown): number | undefined {
    if (!error || typeof error !== 'object') return undefined
    const status = (error as { status?: unknown }).status
    return typeof status === 'number' ? status : undefined
}

export type SchemaIssueSummary = {
    path: string
    code: string
    message: string
}

export function summarizeSchemaValidationError(error: unknown, maxIssues: number = 5): { issueCount: number; issues: SchemaIssueSummary[] } | null {
    if (!error || typeof error !== 'object') return null
    const issuesRaw = (error as { issues?: unknown }).issues
    if (!Array.isArray(issuesRaw)) return null

    const issues = issuesRaw
        .slice(0, maxIssues)
        .map((issue): SchemaIssueSummary => {
            if (!issue || typeof issue !== 'object') {
                return {
                    path: '(root)',
                    code: 'unknown',
                    message: 'invalid value',
                }
            }

            const item = issue as {
                path?: unknown
                code?: unknown
                message?: unknown
            }

            const pathSegments = Array.isArray(item.path) ? item.path : []
            let path = '(root)'
            for (const segment of pathSegments) {
                if (typeof segment === 'number') {
                    path = `${path}[${segment}]`
                    continue
                }
                const key = String(segment)
                path = path === '(root)' ? key : `${path}.${key}`
            }

            return {
                path,
                code: typeof item.code === 'string' ? item.code : 'unknown',
                message: typeof item.message === 'string' ? item.message : 'invalid value',
            }
        })

    return {
        issueCount: issuesRaw.length,
        issues,
    }
}

export function formatUpstreamAIErrorMessage(error: OpenAIHTTPErrorWithDetails): { message: string; code: string; retriable: boolean; status: number } {
    // Upstream errors are almost always server-side misconfig or temporary service issues.
    // We keep the message short, avoid echoing request payload, and include upstream message if present.
    const upstreamMsg = error.upstreamMessage?.trim()
    const status = error.status
    const provider = error.provider ?? 'openai'
    const providerName = getProviderDisplayName(provider)
    const authCode = provider === 'gemini' ? 'GEMINI_AUTH_ERROR' : 'OPENAI_AUTH_ERROR'
    const badRequestCode = provider === 'gemini' ? 'GEMINI_BAD_REQUEST' : 'OPENAI_BAD_REQUEST'
    const upstreamErrorCode = provider === 'gemini' ? 'GEMINI_UPSTREAM_ERROR' : 'OPENAI_UPSTREAM_ERROR'

    if (status === 401 || status === 403) {
        return {
            message: upstreamMsg
                ? `AI認証エラーです（${providerName}）。設定を確認してください。詳細: ${upstreamMsg}`
                : `AI認証エラーです（${providerName}）。設定を確認してください。`,
            code: authCode,
            retriable: false,
            status: 502,
        }
    }

    if (status === 400 || status === 404 || status === 409 || status === 422) {
        return {
            message: upstreamMsg
                ? `AIリクエストが拒否されました（${providerName}）。詳細: ${upstreamMsg}`
                : `AIリクエストが拒否されました（${providerName}）。設定/入力/モデル指定を確認してください。`,
            code: badRequestCode,
            retriable: false,
            status: 502,
        }
    }

    if (status === 429) {
        const quotaLikeSignal = provider === 'gemini' && (
            (error.upstreamCode?.toLowerCase().includes('quota') ?? false) ||
            (error.upstreamCode?.toLowerCase().includes('resource_exhausted') ?? false) ||
            (error.upstreamType?.toLowerCase().includes('quota') ?? false) ||
            (upstreamMsg?.toLowerCase().includes('quota') ?? false) ||
            (upstreamMsg?.toLowerCase().includes('resource exhausted') ?? false)
        )
        if (quotaLikeSignal) {
            return {
                message: 'Geminiの利用上限に達しました。運用設定（課金・クォータ）を確認してください。',
                code: 'GEMINI_QUOTA_EXCEEDED',
                retriable: false,
                status: 429,
            }
        }
        return {
            message: upstreamMsg
                ? `AIサービスが混雑しています（${providerName}）。詳細: ${upstreamMsg}`
                : `AIサービスが混雑しています（${providerName}）。少し待ってから再送してください。`,
            code: 'AI_UPSTREAM_ERROR',
            retriable: true,
            status: 429,
        }
    }

    if (status >= 500) {
        return {
            message: upstreamMsg
                ? `AIサービス側でエラーが発生しました（${providerName}）。詳細: ${upstreamMsg}`
                : `AIサービス側でエラーが発生しました（${providerName}）。少し待ってから再送してください。`,
            code: 'AI_UPSTREAM_ERROR',
            retriable: true,
            status: 503,
        }
    }

    return {
        message: upstreamMsg
            ? `AI呼び出しに失敗しました（${providerName}）。詳細: ${upstreamMsg}`
            : `AI呼び出しに失敗しました（${providerName}）。`,
        code: upstreamErrorCode,
        retriable: false,
        status: 502,
    }
}
