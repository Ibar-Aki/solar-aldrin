import { useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'

interface ConfettiFanfareProps {
    isActive: boolean
    onComplete?: () => void
}

export function ConfettiFanfare({ isActive, onComplete }: ConfettiFanfareProps) {
    const isRunning = useRef(false)

    useEffect(() => {
        if (isActive && !isRunning.current) {
            isRunning.current = true

            // 紙吹雪の設定
            const duration = 3000
            const animationEnd = Date.now() + duration
            const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 }

            const randomInRange = (min: number, max: number) => {
                return Math.random() * (max - min) + min
            }

            const interval = setInterval(function () {
                const timeLeft = animationEnd - Date.now()

                if (timeLeft <= 0) {
                    clearInterval(interval)
                    isRunning.current = false
                    onComplete?.()
                    return
                }

                const particleCount = 50 * (timeLeft / duration)

                // 左右からランダムに放出
                confetti({
                    ...defaults,
                    particleCount,
                    origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
                })
                confetti({
                    ...defaults,
                    particleCount,
                    origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
                })
            }, 250)

            return () => clearInterval(interval)
        }
    }, [isActive, onComplete])

    return null // canvas-confetti は canvas を body に直接追加するためレンダリングなし
}
