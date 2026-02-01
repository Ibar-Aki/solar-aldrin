import { useEffect } from 'react'

interface SpotlightFanfareProps {
    isActive: boolean
    onComplete?: () => void
}

export function SpotlightFanfare({ isActive, onComplete }: SpotlightFanfareProps) {
    useEffect(() => {
        if (!isActive) return
        const timer = setTimeout(() => {
            onComplete?.()
        }, 4000)
        return () => clearTimeout(timer)
    }, [isActive, onComplete])

    if (!isActive) return null

    return (
        <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
            {/* 暗幕背景 */}
            <div className="absolute inset-0 bg-black/80 animate-fade-in duration-1000"></div>

            {/* スポットライト効果 */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_10%,_black_60%)] animate-spotlight-move"></div>

            {/* テキスト */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                <h1 className="text-4xl font-bold tracking-[0.5em] mb-4 animate-slide-up [text-shadow:0_0_20px_white]">
                    安全第一
                </h1>
                <p className="text-xl text-gray-300 animate-slide-up delay-1000 opacity-0 fill-mode-forwards">
                    本日もご安全に
                </p>
            </div>

            {/* 光の粒子 */}
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-50"></div>
        </div>
    )
}
