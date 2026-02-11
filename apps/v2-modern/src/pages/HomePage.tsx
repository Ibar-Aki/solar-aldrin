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
import { getLatestSession } from '@/lib/db'
import { History } from 'lucide-react'
import { clearApiToken, getApiToken, maskApiToken, setApiToken } from '@/lib/apiToken'
import { shouldRequireApiTokenClient } from '@/lib/envFlags'

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
    const [latestAvailable, setLatestAvailable] = useState(false)
    const [apiTokenInput, setApiTokenInput] = useState('')
    const [apiTokenMasked, setApiTokenMasked] = useState(() => maskApiToken(getApiToken()))
    const [apiTokenHint, setApiTokenHint] = useState<string | null>(null)
    const requireApiToken = shouldRequireApiTokenClient()

    // Clear location state after prefill applied (prevent re-prefill on refresh)
    // P2: Router経由でstateをクリア（window.history.replaceStateはRouter履歴を壊す）
    useEffect(() => {
        if (prefill) {
            navigate('.', { replace: true, state: null })
        }
    }, [prefill, navigate])

    useEffect(() => {
        let cancelled = false
        const loadLatest = async () => {
            try {
                const latest = await getLatestSession()
                if (!cancelled) {
                    setLatestAvailable(!!latest)
                }
            } catch (error) {
                console.error('Failed to load latest session:', error)
                if (!cancelled) {
                    setLatestAvailable(false)
                }
            }
        }
        void loadLatest()
        return () => {
            cancelled = true
        }
    }, [])

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

    const handleSaveApiToken = () => {
        const raw = apiTokenInput.trim()
        if (!raw) return
        setApiToken(raw)
        setApiTokenMasked(maskApiToken(raw))
        setApiTokenInput('')

        // トークン文字列は任意だが、現行運用は 64桁hex を想定しているため注意喚起する（保存は続行）。
        const looksLikeHex64 = /^[a-f0-9]{64}$/i.test(raw)
        setApiTokenHint(looksLikeHex64 ? null : 'トークン形式が想定（64桁の16進）と異なります。認証エラー時は値を確認してください。')
    }

    const handleClearApiToken = () => {
        clearApiToken()
        setApiTokenMasked('')
        setApiTokenHint(null)
    }

    const handleUseLatest = async () => {
        try {
            const latest = await getLatestSession()
            if (!latest) return
            setUserName(latest.userName ?? '')
            setSiteName(latest.siteName ?? '')
            setProcessPhase((latest.processPhase ?? 'フリー') as ProcessPhase)
        } catch (error) {
            console.error('Failed to apply latest session:', error)
        }
    }

    const renderApiTokenSettings = () => (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium text-slate-800">APIトークン設定（必要な場合）</div>
                <div className="text-xs text-slate-600">
                    {apiTokenMasked ? `設定済み: ${apiTokenMasked}` : '未設定'}
                </div>
            </div>
            <Input
                value={apiTokenInput}
                onChange={(e) => setApiTokenInput(e.target.value)}
                placeholder="APIトークン（Workers側で認証が必要な環境のみ）"
                type="password"
                className="placeholder:text-muted-foreground/70"
                data-testid="input-api-token"
            />
            <div className="flex gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSaveApiToken}
                    disabled={!apiTokenInput.trim()}
                    className="flex-1"
                >
                    保存
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClearApiToken}
                    disabled={!apiTokenMasked}
                    className="flex-1"
                >
                    削除
                </Button>
            </div>
            {apiTokenHint && (
                <Alert>
                    <AlertDescription>{apiTokenHint}</AlertDescription>
                </Alert>
            )}
            <div className="text-xs text-slate-600">
                トークンは端末のブラウザ（localStorage）に保存されます。
            </div>
        </div>
    )

    // 進行中のセッションがある場合
    if (session && session.completedAt === null) {
        return (
            <div className="min-h-screen bg-gray-50 p-4">
                <div className="max-w-md mx-auto space-y-4 pt-8">
                    <Card className="py-3">
                        <CardHeader className="text-center py-2">
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
                            {requireApiToken && renderApiTokenSettings()}
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
                <Card className="py-3">
                    <CardHeader className="text-center py-2">
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
                    <CardHeader className="flex items-center justify-between gap-2">
                        <CardTitle className="text-lg">基本情報を入力</CardTitle>
                        {latestAvailable && (
                            <Button
                                type="button"
                                onClick={handleUseLatest}
                                className="h-9 rounded-full border border-blue-200 bg-blue-50 px-4 text-sm font-medium text-blue-700 hover:bg-blue-100"
                            >
                                <History className="mr-2 h-4 w-4" />
                                前回と同じ
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {requireApiToken && renderApiTokenSettings()}
                        <div>
                            <label className="text-sm font-medium text-gray-700">作業者名</label>
                            <Input
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                                placeholder="例：田中太郎"
                                className="mt-1 placeholder:text-muted-foreground/70"
                                data-testid="input-username"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">現場名</label>
                            <Input
                                value={siteName}
                                onChange={(e) => setSiteName(e.target.value)}
                                placeholder="例：〇〇ビル改修工事"
                                className="mt-1 placeholder:text-muted-foreground/70"
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

                {/* 履歴ボタン (HIS-02) */}
                <Button
                    variant="outline"
                    className="w-full h-12 border-blue-200 text-blue-700 font-semibold shadow-sm hover:bg-blue-50 hover:border-blue-300"
                    onClick={() => navigate('/history')}
                >
                    📂 過去の記録を見る
                </Button>

                {/* 説明 */}
                <Card className="py-3">
                    <CardContent className="py-3">
                        <p className="text-sm text-gray-600">
                            AIアシスタントが対話形式でKY活動をサポートします。
                            作業内容、危険、対策を順番に入力していきます。
                        </p>
                    </CardContent>
                </Card>

            </div>
        </div >
    )
}

