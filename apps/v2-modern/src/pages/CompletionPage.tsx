import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, CheckCircle2, Download, Home } from 'lucide-react'
import { useKYStore } from '@/stores/kyStore'
import { usePDFGenerator } from '@/hooks/usePDFGenerator'
import { FanfareManager, type FanfarePattern } from '@/components/fanfare/FanfareManager'

export function CompletionPage() {
    const navigate = useNavigate()
    const { session, status, clearSession, saveSessionToDb } = useKYStore()
    const { generateAndDownload, isGenerating } = usePDFGenerator()

    // ファンファーレ状態管理
    const [fanfarePattern, setFanfarePattern] = useState<FanfarePattern>('none')
    const [isFanfareActive, setIsFanfareActive] = useState(false)

    // FIX-03: useRefで保存試行をガード（依存配列問題を回避）
    const saveAttemptedRef = useRef(false)

    // セッション完了時にスポットライトを自動再生 & DB保存
    useEffect(() => {
        if (session && status === 'completed') {
            // 初回表示時にスポットライトを自動再生
            setFanfarePattern('spotlight')
            setIsFanfareActive(true)

            // IndexedDBに保存（一度だけ）
            if (saveAttemptedRef.current) return
            saveAttemptedRef.current = true
            void saveSessionToDb().then((success) => {
                if (success && import.meta.env.DEV) console.log('Session saved to history')
            })
        } else if (!session) {
            navigate('/')
        }
    }, [session, status, navigate, saveSessionToDb])

    const handleDownload = async () => {
        if (!session) return
        await generateAndDownload(session)
    }

    const handleHome = () => {
        clearSession()
        navigate('/')
    }

    const playFanfare = (pattern: FanfarePattern) => {
        setFanfarePattern(pattern)
        setIsFanfareActive(false)
        // リセットしてから再生
        setTimeout(() => {
            setIsFanfareActive(true)
        }, 50)
    }

    if (!session) return null

    return (
        <div className="min-h-screen bg-gray-50 p-4 pb-12">
            <FanfareManager
                pattern={fanfarePattern}
                isActive={isFanfareActive}
                onComplete={() => setIsFanfareActive(false)}
            />

            <div className="max-w-md mx-auto space-y-6">
                {/* 完了メッセージ */}
                <div className="text-center space-y-2 py-8">
                    <div className="flex justify-center mb-4">
                        <CheckCircle2 className="w-16 h-16 text-green-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">KY活動 完了</h1>
                    <p className="text-gray-500">
                        お疲れ様でした。<br />
                        今日も一日ご安全に！
                    </p>
                </div>

                {/* 完了の儀式（簡易版） */}
                <Card className="border-green-200 bg-green-50">
                    <CardContent className="pt-4">
                        <div className="flex gap-2">
                            <Button
                                variant={fanfarePattern === 'spotlight' ? 'default' : 'outline'}
                                size="sm"
                                className="flex-1"
                                onClick={() => playFanfare('spotlight')}
                            >
                                🔦 スポットライト
                            </Button>
                            <Button
                                variant={fanfarePattern === 'yoshi' ? 'default' : 'outline'}
                                size="sm"
                                className="flex-1"
                                onClick={() => playFanfare('yoshi')}
                            >
                                👈 ヨシ！
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* 行動目標カード */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">今日の行動目標</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="bg-blue-50 p-4 rounded-lg text-center">
                            <p className="text-xl font-bold text-blue-700">
                                {session.actionGoal || '（未設定）'}
                            </p>
                            <p className="text-sm text-blue-600 mt-2 font-bold">
                                ヨシ！
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* アクションボタン */}
                <div className="space-y-3">
                    <Button
                        onClick={handleDownload}
                        className="w-full h-12 text-base"
                        disabled={isGenerating}
                    >
                        <Download className="mr-2 h-5 w-5" />
                        {isGenerating ? '生成中...' : 'PDF記録をダウンロード'}
                    </Button>

                    <Button
                        variant="outline"
                        onClick={handleHome}
                        className="w-full h-12"
                    >
                        <Home className="mr-2 h-5 w-5" />
                        ホームに戻る
                    </Button>
                </div>

                {/* ヒヤリハット報告（簡易） */}
                {session.hadNearMiss && (
                    <div className="bg-orange-50 p-4 rounded-lg flex gap-3 text-sm text-orange-800">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <div>
                            <span className="font-bold">ヒヤリハット記録あり</span>
                            <br />
                            {session.nearMissNote}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
