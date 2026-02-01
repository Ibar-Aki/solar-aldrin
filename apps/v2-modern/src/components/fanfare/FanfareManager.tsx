import { useEffect, useRef } from 'react'
import { ConfettiFanfare } from './ConfettiFanfare'
import { YoshiStampFanfare } from './YoshiStampFanfare'
import { SoundOnlyFanfare } from './SoundOnlyFanfare'
import { FireworksFanfare } from './FireworksFanfare'
import { SpotlightFanfare } from './SpotlightFanfare'
import { useTTS } from '@/hooks/useTTS'

export type FanfarePattern = 'confetti' | 'yoshi' | 'sound' | 'fireworks' | 'spotlight' | 'none'

interface FanfareManagerProps {
    pattern: FanfarePattern
    isActive: boolean
    onComplete?: () => void
}

export function FanfareManager({ pattern, isActive, onComplete }: FanfareManagerProps) {
    const { speak } = useTTS({ messageId: 'fanfare-completion' })
    const hasSpokenRef = useRef(false)

    // Reset spoken state when pattern or active state changes
    useEffect(() => {
        if (!isActive) {
            hasSpokenRef.current = false
        }
    }, [isActive])

    // Handle TTS based on pattern
    useEffect(() => {
        if (isActive && !hasSpokenRef.current) {
            hasSpokenRef.current = true

            // パターンごとの音声振り分け
            switch (pattern) {
                case 'yoshi':
                    speak('ヨシ！本日のKY活動、完了です！')
                    break
                case 'sound':
                    speak('お疲れ様でした。本日もご安全に。')
                    break
                case 'spotlight':
                    // スポットライトは視覚効果に合わせて遅延させてもいいが、今回は即再生
                    speak('安全第一。本日もゼロ災で行こう！ヨシ！')
                    break
                case 'fireworks':
                    speak('素晴らしい！KY完了です！')
                    break
                case 'confetti':
                    speak('お疲れ様でした！')
                    break
                default:
                    break
            }
        }
    }, [isActive, pattern, speak])

    if (!isActive || pattern === 'none') return null

    return (
        <>
            {pattern === 'confetti' && (
                <ConfettiFanfare isActive={isActive} onComplete={onComplete} />
            )}
            {pattern === 'yoshi' && (
                <YoshiStampFanfare isActive={isActive} onComplete={onComplete} />
            )}
            {pattern === 'sound' && (
                <SoundOnlyFanfare isActive={isActive} onComplete={onComplete} />
            )}
            {pattern === 'fireworks' && (
                <FireworksFanfare isActive={isActive} onComplete={onComplete} />
            )}
            {pattern === 'spotlight' && (
                <SpotlightFanfare isActive={isActive} onComplete={onComplete} />
            )}
        </>
    )
}
