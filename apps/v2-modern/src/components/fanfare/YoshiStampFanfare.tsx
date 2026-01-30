import { useEffect, useState } from 'react'

interface YoshiStampFanfareProps {
    isActive: boolean
    onComplete?: () => void
}

export function YoshiStampFanfare({ isActive, onComplete }: YoshiStampFanfareProps) {
    const [show, setShow] = useState(false)

    useEffect(() => {
        if (isActive) {
            setShow(true)
            const timer = setTimeout(() => {
                setShow(false)
                onComplete?.()
            }, 3000)
            return () => clearTimeout(timer)
        }
    }, [isActive, onComplete])

    if (!show) return null

    return (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
            {/* スタンプ本体 */}
            <div className="relative animate-stamp-bounce">
                <div className="border-[8px] border-red-600 rounded-full w-48 h-48 flex items-center justify-center bg-white/90 shadow-xl transform rotate-[-15deg]">
                    <div className="text-center">
                        <div className="text-red-600 text-6xl font-black tracking-widest leading-none">
                            ヨシ！
                        </div>
                        <div className="text-red-600 text-sm font-bold mt-2 border-t-2 border-red-600 pt-1">
                            KYCONFIRMED
                        </div>
                    </div>
                </div>
                {/* エフェクト円 */}
                <div className="absolute inset-0 border-4 border-red-400 rounded-full animate-ping opacity-75"></div>
            </div>

            {/* 衝撃波エフェクト（背景） */}
            <div className="absolute inset-0 bg-white/30 animate-flash"></div>
        </div>
    )
}
