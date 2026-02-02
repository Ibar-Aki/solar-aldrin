import { v4 as uuidv4 } from 'uuid'

const STORAGE_KEY = 'voice-ky-client-id'

export function getClientId(): string {
    if (typeof window === 'undefined') {
        return 'server'
    }

    try {
        const stored = window.localStorage.getItem(STORAGE_KEY)
        if (stored) return stored

        const created = typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : uuidv4()

        window.localStorage.setItem(STORAGE_KEY, created)
        return created
    } catch {
        return uuidv4()
    }
}
