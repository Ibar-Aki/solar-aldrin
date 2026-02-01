import { useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'

interface FireworksFanfareProps {
    isActive: boolean
    onComplete?: () => void
}

export function FireworksFanfare({ isActive, onComplete }: FireworksFanfareProps) {
    const isRunning = useRef(false)

    useEffect(() => {
        if (isActive && !isRunning.current) {
            isRunning.current = true

            const duration = 5000
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

                // 花火のように下から打ち上げ
                confetti({
                    ...defaults,
                    particleCount,
                    origin: { x: randomInRange(0.1, 0.9), y: Math.random() - 0.2 },
                    colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'],
                    shapes: ['square', 'circle'],
                    gravity: 0.8,
                    scalar: 1.2,
                    drift: 0,
                })
            }, 400) // Launch frequency

            return () => clearInterval(interval)
        }
    }, [isActive, onComplete])

    return null
}
