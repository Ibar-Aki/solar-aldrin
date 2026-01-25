import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useKYStore } from '@/stores/kyStore'

export function CompletionPage() {
    const navigate = useNavigate()
    const { session, completeSession, clearSession } = useKYStore()

    const [actionGoal, setActionGoal] = useState('')
    const [pointingConfirmed, setPointingConfirmed] = useState(false)
    const [allMeasuresImplemented, setAllMeasuresImplemented] = useState(false)
    const [hadNearMiss, setHadNearMiss] = useState(false)
    const [nearMissNote, setNearMissNote] = useState('')
    const [isCompleting, setIsCompleting] = useState(false)

    useEffect(() => {
        if (!session) {
            navigate('/', { replace: true })
        }
    }, [session, navigate])

    if (!session) return null

    const handleComplete = async () => {
        if (!actionGoal.trim()) return

        setIsCompleting(true)
        try {
            completeSession({
                actionGoal: actionGoal.trim(),
                pointingConfirmed,
                allMeasuresImplemented,
                hadNearMiss,
                nearMissNote: hadNearMiss ? nearMissNote : undefined,
            })
            // TODO: PDF生成へ遷移
            alert('KY活動が完了しました！（PDF出力は次のステップで実装）')
        } finally {
            setIsCompleting(false)
        }
    }

    const handleNewSession = () => {
        clearSession()
        navigate('/')
    }

    // 完了済みの場合
    if (session.completedAt) {
        return (
            <div className="min-h-screen bg-gray-50 p-4">
                <div className="max-w-md mx-auto space-y-4 pt-8">
                    <Card>
                        <CardHeader className="text-center">
                            <CardTitle className="text-2xl font-bold text-green-600">
                                ✅ KY活動完了
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="bg-blue-50 p-4 rounded-lg">
                                <p className="font-medium text-blue-800">今日の行動目標</p>
                                <p className="text-lg mt-1">「{session.actionGoal}」</p>
                            </div>
                            <div className="text-sm text-gray-600">
                                <p>作業数: {session.workItems.length}件</p>
                                <p>完了日時: {new Date(session.completedAt).toLocaleString('ja-JP')}</p>
                            </div>
                            <Button onClick={handleNewSession} className="w-full">
                                新しいKY活動を開始
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <div className="max-w-md mx-auto space-y-4 pt-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl">KY活動の仕上げ</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* 作業サマリー */}
                        <div className="bg-gray-100 p-3 rounded-lg">
                            <p className="text-sm font-medium">登録した作業: {session.workItems.length}件</p>
                            <ul className="text-sm text-gray-600 mt-2 space-y-1">
                                {session.workItems.map((item, i) => (
                                    <li key={item.id}>
                                        {i + 1}. {item.workDescription.substring(0, 30)}
                                        {item.workDescription.length > 30 ? '...' : ''}
                                        (危険度: {item.riskLevel})
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* 行動目標 */}
                        <div>
                            <label className="text-sm font-medium text-gray-700">
                                今日の行動目標 <span className="text-red-500">*</span>
                            </label>
                            <Input
                                value={actionGoal}
                                onChange={(e) => setActionGoal(e.target.value)}
                                placeholder="例：高所作業時は必ず二丁掛けを徹底する"
                                className="mt-1"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                「〇〇を徹底する」「〇〇に注意する」など具体的に
                            </p>
                        </div>

                        {/* 確認項目 */}
                        <div className="space-y-3">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={pointingConfirmed}
                                    onChange={(e) => setPointingConfirmed(e.target.checked)}
                                    className="w-4 h-4"
                                />
                                <span className="text-sm">指差し呼称を実施した</span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={allMeasuresImplemented}
                                    onChange={(e) => setAllMeasuresImplemented(e.target.checked)}
                                    className="w-4 h-4"
                                />
                                <span className="text-sm">上記の対策をすべて実施する</span>
                            </label>
                        </div>

                        {/* ヒヤリハット */}
                        <div className="border-t pt-4">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={hadNearMiss}
                                    onChange={(e) => setHadNearMiss(e.target.checked)}
                                    className="w-4 h-4"
                                />
                                <span className="text-sm">ヒヤリハットがあった（任意）</span>
                            </label>
                            {hadNearMiss && (
                                <Input
                                    value={nearMissNote}
                                    onChange={(e) => setNearMissNote(e.target.value)}
                                    placeholder="内容を記入"
                                    className="mt-2"
                                />
                            )}
                        </div>

                        {/* 完了ボタン */}
                        <Button
                            onClick={handleComplete}
                            disabled={isCompleting || !actionGoal.trim()}
                            className="w-full h-12 text-lg"
                        >
                            {isCompleting ? '処理中...' : 'KY活動を完了する'}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
