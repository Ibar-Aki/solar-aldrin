import type { TelemetryEventName } from '@/lib/observability/telemetry'

export type ConversationMessage = {
    role: 'user' | 'assistant' | 'system'
    content: string
}

export function countConversationTurns(messages: ConversationMessage[]): number {
    return messages.reduce((count, message) => {
        if (message.role !== 'user') return count
        if (message.content.trim().length === 0) return count
        return count + 1
    }, 0)
}

export type TelemetryEventLike = {
    event: TelemetryEventName
}

type ErrorLoopOptions = {
    threshold?: number
}

export function detectErrorLoopFromEvents(
    events: TelemetryEventLike[],
    options: ErrorLoopOptions = {}
): boolean {
    const threshold = Math.max(2, options.threshold ?? 3)
    let consecutiveErrors = 0

    for (const entry of events) {
        switch (entry.event) {
            case 'chat_error':
            case 'retry_failed':
                consecutiveErrors += 1
                break
            case 'retry_succeeded':
            case 'session_complete':
                consecutiveErrors = 0
                break
            default:
                break
        }

        if (consecutiveErrors >= threshold) {
            return true
        }
    }

    return false
}
