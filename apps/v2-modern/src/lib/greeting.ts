export type TimeGreeting = 'おはようございます！' | 'こんにちは！' | 'こんばんは！'

export function getTimeGreeting(now: Date = new Date()): TimeGreeting {
    const hour = now.getHours()

    if (hour >= 5 && hour <= 11) return 'おはようございます！'
    if (hour >= 12 && hour <= 17) return 'こんにちは！'
    return 'こんばんは！'
}

