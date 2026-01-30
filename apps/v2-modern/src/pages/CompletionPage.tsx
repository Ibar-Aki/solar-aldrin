import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, CheckCircle2, Download, Home, Sparkles } from 'lucide-react'
import { useKYStore } from '@/stores/kyStore'
import { usePDFGenerator } from '@/hooks/usePDFGenerator'
import { FanfareManager, type FanfarePattern } from '@/components/fanfare/FanfareManager'

export function CompletionPage() {
    const navigate = useNavigate()
    const { session, status, clearSession } = useKYStore()
    const { generateAndDownload, isGenerating } = usePDFGenerator()

    // ファンファーレ状態管理
    const [fanfarePattern, setFanfarePattern] = useState<FanfarePattern>('none')
    const [isFanfareActive, setIsFanfareActive] = useState(false)

    // セッション完了時にデフォルトで紙吹雪を出す（初回のみ）
    useEffect(() => {
        if (session && status === 'completed') {
            // 自動再生は一旦オフ（ユーザーが選んで再生するように変更）
            // setFanfarePattern('confetti')
            // setIsFanfareActive(true)
        } else if (!session) {
            navigate('/')
        }
    }, [session, status, navigate])

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

                {/* ファンファーレ試写室 (Pre-Phase 2.2 Feature) */}
                <Card className="border-yellow-200 bg-yellow-50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-yellow-800">
                            <Sparkles className="w-4 h-4" />
                            完了の儀式（プレビュー）
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-yellow-700 mb-3">
                            実装された5つのパターンを試めます。気に入ったものをタップしてください。
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="bg-white"
                                onClick={() => playFanfare('confetti')}
                            >
                                🎉 紙吹雪
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="bg-white"
                                onClick={() => playFanfare('yoshi')}
                            >
                                👈 ヨシ！
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="bg-white"
                                onClick={() => playFanfare('sound')}
                            >
                                🔊 音声のみ
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="bg-white"
                                onClick={() => playFanfare('fireworks')}
                            >
                                🎆 花火
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="bg-white col-span-2"
                                onClick={() => playFanfare('spotlight')}
                            >
                                🔦 スポットライト
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
