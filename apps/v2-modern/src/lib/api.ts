/**
 * API クライアント
 * OpenAI Chat API との通信
 */
import type { ExtractedData } from '@/types/ky'

export interface ChatRequest {
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[]
    sessionContext: {
        userName: string
        siteName: string
        weather: string
        workItemCount: number
    }
}

export interface ChatResponse {
    reply: string
    extracted?: ExtractedData
}

const API_BASE = '/api'

/**
 * Chat API を呼び出す
 */
export async function postChat(request: ChatRequest): Promise<ChatResponse> {
    const token = import.meta.env.VITE_API_TOKEN

    const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(request),
    })

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error((errorData as { error?: string }).error || 'AI応答の取得に失敗しました')
    }

    return res.json()
}
