import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { WeatherSelector } from '@/components/WeatherSelector'
import { useKYStore } from '@/stores/kyStore'
import type { ProcessPhase, HealthCondition } from '@/types/ky'
import { PROCESS_PHASES, HEALTH_CONDITIONS, WEATHER_OPTIONS } from '@/constants/ky'

// Prefill型（HIS-03: 履歴からの引用）
interface PrefillData {
    siteName?: string
    userName?: string
    weather?: string
    processPhase?: ProcessPhase
    healthCondition?: HealthCondition
}

export function HomePage() {
    const navigate = useNavigate()
    const location = useLocation()
    const { session, startSession, clearSession } = useKYStore()

    // Prefill data from history (HIS-03)
    const prefill = (location.state as { prefill?: PrefillData } | null)?.prefill

    const [userName, setUserName] = useState(prefill?.userName ?? '')
    const [siteName, setSiteName] = useState(prefill?.siteName ?? '')
    const [weather, setWeather] = useState(prefill?.weather ?? '晴れ')
    const [processPhase, setProcessPhase] = useState<ProcessPhase>(prefill?.processPhase ?? 'フリー')
    const [healthCondition, setHealthCondition] = useState<HealthCondition>(prefill?.healthCondition ?? 'good')
    const [isStarting, setIsStarting] = useState(false)

    // Clear location state after prefill applied (prevent re-prefill on refresh)
    // P2: Router経由でstateをクリア（window.history.replaceStateはRouter履歴を壊す）
    useEffect(() => {
        if (prefill) {
            navigate('.', { replace: true, state: null })
        }
    }, [prefill, navigate])

    // 日付表示 (UX-10) - 絵文字なし
    const today = new Date()
    const formattedDate = today.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
    })

    const handleStart = async () => {
        if (!userName.trim() || !siteName.trim()) return

        setIsStarting(true)
        try {
            startSession(userName.trim(), siteName.trim(), weather, processPhase, healthCondition)
            navigate('/session')
        } finally {
            setIsStarting(false)
        }
    }

    const handleContinue = () => {
        navigate('/session')
    }

    const handleClear = () => {
        if (confirm('進行中のセッションを破棄しますか？')) {
            clearSession()
        }
    }

    // 進行中のセッションがある場合
    if (session && session.completedAt === null) {
        return (
            <div className="min-h-screen bg-gray-50 p-4">
                <div className="max-w-md mx-auto space-y-4 pt-8">
                    <Card>
                        <CardHeader className="text-center py-3">
                            <CardTitle className="text-2xl font-bold text-blue-600">
                                Voice KY Assistant
                            </CardTitle>
                            <CardDescription>一人KY活動ver</CardDescription>
                            <CardDescription className="text-base font-medium">{formattedDate}</CardDescription>
                        </CardHeader>
                    </Card>

                    <Alert>
                        <AlertDescription>
                            📝 進行中のセッションがあります
                        </AlertDescription>
                    </Alert>

                    <Card>
                        <CardContent className="pt-6 space-y-4">
                            <div className="text-sm text-gray-600">
                                <p><strong>現場:</strong> {session.siteName}</p>
                                <p><strong>作業者:</strong> {session.userName}</p>
                                <p><strong>登録済み作業:</strong> {session.workItems.length}件</p>
                            </div>
                            <Button onClick={handleContinue} className="w-full">
                                続きから再開
                            </Button>
                            <Button onClick={handleClear} variant="outline" className="w-full">
                                破棄して新規作成
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
                {/* ヘッダー */}
                <Card>
                    <CardHeader className="text-center py-3">
                        <CardTitle className="text-2xl font-bold text-blue-600">
                            Voice KY Assistant
                        </CardTitle>
                        <CardDescription>
                            一人KY活動ver
                        </CardDescription>
                        <CardDescription className="text-base font-medium">
                            {formattedDate}
                        </CardDescription>
                    </CardHeader>
                </Card>

                {/* 入力フォーム */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">基本情報を入力</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-gray-700">作業者名</label>
                            <Input
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                                placeholder="例：田中太郎"
                                className="mt-1"
                                data-testid="input-username"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">現場名</label>
                            <Input
                                value={siteName}
                                onChange={(e) => setSiteName(e.target.value)}
                                placeholder="例：〇〇ビル改修工事"
                                className="mt-1"
                                data-testid="input-sitename"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">天候</label>
                            <WeatherSelector
                                value={weather}
                                onChange={setWeather}
                                options={WEATHER_OPTIONS}
                            />
                        </div>
                        {/* 工程選択 (UX-11) */}
                        <div>
                            <label className="text-sm font-medium text-gray-700">今日の工程</label>
                            <select
                                value={processPhase}
                                onChange={(e) => setProcessPhase(e.target.value as ProcessPhase)}
                                className="mt-1 w-full border rounded-md p-2"
                                data-testid="select-phase"
                            >
                                {PROCESS_PHASES.map((phase) => (
                                    <option key={phase} value={phase}>{phase}</option>
                                ))}
                            </select>
                        </div>
                        {/* 体調チェック (UX-12) */}
                        <div>
                            <label className="text-sm font-medium text-gray-700">今日の体調</label>
                            <div className="flex gap-2 mt-1">
                                {HEALTH_CONDITIONS.map((cond) => (
                                    <Button
                                        key={cond.value}
                                        variant={healthCondition === cond.value ? 'default' : 'outline'}
                                        onClick={() => setHealthCondition(cond.value)}
                                        className={`flex-1 ${healthCondition === cond.value ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                                        size="sm"
                                        type="button"
                                        data-testid={`btn-health-${cond.value}`}
                                    >
                                        {cond.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <Button
                            className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700"
                            onClick={handleStart}
                            disabled={isStarting || !userName.trim() || !siteName.trim()}
                            data-testid="button-start-ky"
                        >
                            {isStarting ? '準備中...' : 'KY活動を開始'}
                        </Button>
                    </CardContent>
                </Card>

                {/* 説明 */}
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-sm text-gray-600">
                            AIアシスタントが対話形式でKY活動をサポートします。
                            作業内容、危険、対策を順番に入力していきます。
                        </p>
                    </CardContent>
                </Card>

                {/* 履歴ボタン (HIS-02) */}
                <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate('/history')}
                >
                    📂 過去の記録を見る
                </Button>
            </div>
        </div >
    )
}

