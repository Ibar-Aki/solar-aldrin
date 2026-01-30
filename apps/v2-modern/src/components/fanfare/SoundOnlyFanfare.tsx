import { useEffect } from 'react'

interface SoundOnlyFanfareProps {
    isActive: boolean
    onComplete?: () => void
}

export function SoundOnlyFanfare({ isActive, onComplete }: SoundOnlyFanfareProps) {
    useEffect(() => {
        if (isActive) {
            // ここでは視覚効果は何もしない
            // TTS再生は親コンポーネント（Manager）側で共通制御するか、あるいはここで呼ぶか
            // 今回はManager側でTTSを呼ぶ想定として、onCompleteだけ返す
            const timer = setTimeout(() => {
                onComplete?.()
            }, 2000)
            return () => clearTimeout(timer)
        }
    }, [isActive, onComplete])

    return null
}
