export const MAX_CLIENT_HISTORY_MESSAGES = 12
export const CONVERSATION_SUMMARY_MIN_MESSAGES = 6

type ChatMessage = {
    role: unknown
    content: string
}

type RequestMessage = {
    role: 'user' | 'assistant'
    content: string
}

function isRequestRole(role: unknown): role is RequestMessage['role'] {
    return role === 'user' || role === 'assistant'
}

export function buildRequestMessages(params: {
    messages: ChatMessage[]
    text: string
    skipUserMessage: boolean
    retryAssistantMessage: string
}): RequestMessage[] {
    const { messages, text, skipUserMessage, retryAssistantMessage } = params

    const chatMessages: RequestMessage[] = messages
        .filter((message): message is RequestMessage => isRequestRole(message.role))
        .map(message => ({ role: message.role, content: message.content }))

    if (!skipUserMessage) {
        const combined = [...chatMessages, { role: 'user' as const, content: text }]
        return combined.slice(-MAX_CLIENT_HISTORY_MESSAGES)
    }

    // リトライ時は末尾のエラーメッセージを除去し、同じユーザー発言を末尾に置く
    const sanitized = [...chatMessages]
    const last = sanitized[sanitized.length - 1]
    if (last && last.role === 'assistant' && last.content === retryAssistantMessage) {
        sanitized.pop()
    }
    const lastAfter = sanitized[sanitized.length - 1]
    if (!lastAfter || lastAfter.role !== 'user' || lastAfter.content !== text) {
        sanitized.push({ role: 'user' as const, content: text })
    }
    return sanitized.slice(-MAX_CLIENT_HISTORY_MESSAGES)
}
