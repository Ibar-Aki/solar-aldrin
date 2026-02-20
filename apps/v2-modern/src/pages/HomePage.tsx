import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { WeatherSelector } from '@/components/WeatherSelector'
import { VoiceConversationModeToggle } from '@/components/VoiceConversationModeToggle'
import { useKYStore } from '@/stores/kyStore'
import { useVoiceConversationModeStore } from '@/stores/useVoiceConversationModeStore'
import type { ProcessPhase, HealthCondition } from '@/types/ky'
import { PROCESS_PHASES, HEALTH_CONDITIONS, WEATHER_OPTIONS } from '@/constants/ky'
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

async function fetchLatestSession() {
    const { getLatestSession } = await import('@/lib/db')
    return getLatestSession()
}

export function HomePage() {
    const navigate = useNavigate()
    const location = useLocation()
    const { session, startSession, clearSession } = useKYStore()
    const { mode, setMode } = useVoiceConversationModeStore()

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
                const latest = await fetchLatestSession()
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
    const formattedDate = useMemo(() => new Date().toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
    }), [])
    const fieldLabelClass = 'text-sm font-semibold text-slate-700'
    const requiredBadgeClass = 'ml-2 inline-flex rounded-full bg-[var(--brand-100)] px-2 py-0.5 text-[10px] font-medium text-[var(--brand-700)]'
    const helperTextClass = 'mt-1 text-xs text-[var(--text-muted)]'

    const handleStart = async () => {
        if (!userName.trim() || !siteName.trim()) return

        setIsStarting(true)
        try {
            startSession(userName.trim(), siteName.trim(), weather, processPhase, healthCondition)
            navigate('/session', { state: { entry: 'new' as const } })
        } finally {
            setIsStarting(false)
        }
    }

    const handleContinue = () => {
        navigate('/session', { state: { entry: 'resume' as const } })
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
            const latest = await fetchLatestSession()
            if (!latest) return
            setUserName(latest.userName ?? '')
            setSiteName(latest.siteName ?? '')
            setProcessPhase((latest.processPhase ?? 'フリー') as ProcessPhase)
        } catch (error) {
            console.error('Failed to apply latest session:', error)
        }
    }

    const renderApiTokenSettings = () => (
        <div className="space-y-2 rounded-lg border border-[color:var(--surface-border)] bg-[var(--surface-card)] p-3">
            <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium text-slate-800">APIトークン設定（必要な場合）</div>
                <div className="text-xs text-[var(--text-muted)]">
                    {apiTokenMasked ? `設定済み: ${apiTokenMasked}` : '未設定'}
                </div>
            </div>
            <Input
                value={apiTokenInput}
                onChange={(e) => setApiTokenInput(e.target.value)}
                placeholder="APIトークン（Workers側で認証が必要な環境のみ）"
                type="password"
                className="border-[color:var(--surface-border)] bg-[var(--surface-card)] placeholder:text-muted-foreground/70"
                data-testid="input-api-token"
            />
            <div className="flex gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSaveApiToken}
                    disabled={!apiTokenInput.trim()}
                    className="flex-1 border-[color:var(--surface-border)] bg-[var(--surface-card)] text-slate-700 hover:bg-[var(--brand-50)]"
                >
                    保存
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClearApiToken}
                    disabled={!apiTokenMasked}
                    className="flex-1 border-[color:var(--surface-border)] bg-[var(--surface-card)] text-slate-700 hover:bg-[var(--brand-50)]"
                >
                    削除
                </Button>
            </div>
            {apiTokenHint && (
                <Alert className="border-[color:var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning-text)]">
                    <AlertDescription>{apiTokenHint}</AlertDescription>
                </Alert>
            )}
            <div className="text-xs text-[var(--text-muted)]">
                トークンは端末のブラウザ（localStorage）に保存されます。
            </div>
        </div>
    )

    // 進行中のセッションがある場合
    if (session && session.completedAt === null) {
        return (
            <div className="min-h-screen bg-[var(--surface-page)] px-4 py-6">
                <div className="mx-auto max-w-md space-y-4">
                    <Card className="overflow-hidden border-[color:var(--surface-border)] bg-[var(--surface-card)] py-3 shadow-sm">
                        <div className="h-1 w-full bg-gradient-to-r from-[var(--brand-600)] to-[var(--brand-400)]" />
                        <CardHeader className="py-2 text-center">
                            <CardTitle className="text-2xl font-bold text-[var(--accent-royal-600)]">
                                Voice KY Assistant
                            </CardTitle>
                            <CardDescription className="text-[var(--accent-royal-600)]">一人KY活動ver</CardDescription>
                            <CardDescription className="text-base font-medium text-slate-700">{formattedDate}</CardDescription>
                        </CardHeader>
                    </Card>

                    <Alert className="border-[color:var(--info-border)] bg-[var(--info-bg)] text-[var(--info-text)]">
                        <AlertDescription>
                            進行中のセッションがあります
                        </AlertDescription>
                    </Alert>

                    <Card className="border-[color:var(--surface-border)] bg-[var(--surface-card)] shadow-sm">
                        <CardContent className="pt-6 space-y-4">
                            <VoiceConversationModeToggle mode={mode} onChange={setMode} />
                            <div className="space-y-1 rounded-lg border border-[color:var(--surface-border)] bg-[var(--surface-muted)] p-3 text-sm text-slate-700">
                                <p><strong>現場:</strong> {session.siteName}</p>
                                <p><strong>作業者:</strong> {session.userName}</p>
                                <p><strong>登録済み作業:</strong> {session.workItems.length}件</p>
                            </div>
                            {requireApiToken && renderApiTokenSettings()}
                            <Button
                                onClick={handleContinue}
                                className="h-11 w-full bg-[var(--accent-vivid-600)] text-[var(--accent-vivid-foreground)] hover:bg-[var(--accent-vivid-700)]"
                            >
                                続きから再開
                            </Button>
                            <Button
                                onClick={handleClear}
                                variant="outline"
                                className="h-11 w-full border-[color:var(--surface-border)] bg-[var(--surface-card)] text-slate-700 hover:bg-[var(--brand-50)]"
                            >
                                破棄して新規作成
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[var(--surface-page)] px-4 py-6">
            <div className="mx-auto max-w-md space-y-4">
                {/* ヘッダー */}
                <Card className="overflow-hidden border-[color:var(--surface-border)] bg-[var(--surface-card)] py-3 shadow-sm">
                    <div className="h-1 w-full bg-gradient-to-r from-[var(--brand-600)] to-[var(--brand-400)]" />
                    <CardHeader className="space-y-1 py-2 text-center">
                        <CardTitle className="text-2xl font-bold text-[var(--accent-royal-600)]">
                            Voice KY Assistant
                        </CardTitle>
                        <CardDescription className="text-[var(--accent-royal-600)]">一人KY活動ver</CardDescription>
                        <CardDescription className="text-base font-medium text-slate-700">
                            {formattedDate}
                        </CardDescription>
                        <p className="text-xs text-[var(--text-muted)]">
                            基本情報を入力すると、すぐに対話を開始できます。
                        </p>
                    </CardHeader>
                </Card>

                {/* 入力フォーム */}
                <Card className="border-[color:var(--surface-border)] bg-[var(--surface-card)] shadow-sm">
                    <CardHeader className="flex items-center justify-between gap-2">
                        <CardTitle className="text-lg text-[var(--accent-royal-600)]">基本情報を入力</CardTitle>
                        {latestAvailable && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleUseLatest}
                                className="h-9 rounded-full border-[color:var(--surface-border)] bg-[var(--surface-card)] px-4 text-sm font-semibold text-[var(--accent-royal-600)] hover:bg-[var(--brand-50)]"
                            >
                                <History className="mr-2 h-4 w-4" />
                                前回と同じ
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <VoiceConversationModeToggle mode={mode} onChange={setMode} />
                        {requireApiToken && renderApiTokenSettings()}
                        <div>
                            <label className={fieldLabelClass}>
                                作業者名
                                <span className={requiredBadgeClass}>必須</span>
                            </label>
                            <Input
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                                placeholder="例：田中太郎"
                                className="mt-1 h-11 border-[color:var(--surface-border)] bg-[var(--surface-card)] placeholder:text-muted-foreground/70"
                                data-testid="input-username"
                            />
                        </div>
                        <div>
                            <label className={fieldLabelClass}>
                                現場名
                                <span className={requiredBadgeClass}>必須</span>
                            </label>
                            <Input
                                value={siteName}
                                onChange={(e) => setSiteName(e.target.value)}
                                placeholder="例：〇〇ビル改修工事"
                                className="mt-1 h-11 border-[color:var(--surface-border)] bg-[var(--surface-card)] placeholder:text-muted-foreground/70"
                                data-testid="input-sitename"
                            />
                        </div>
                        <div>
                            <label className={fieldLabelClass}>天候</label>
                            <WeatherSelector
                                value={weather}
                                onChange={setWeather}
                                options={WEATHER_OPTIONS}
                            />
                        </div>
                        {/* 工程選択 (UX-11) */}
                        <div>
                            <label className={fieldLabelClass}>今日の工程</label>
                            <select
                                value={processPhase}
                                onChange={(e) => setProcessPhase(e.target.value as ProcessPhase)}
                                className="mt-1 h-11 w-full rounded-lg border border-[color:var(--surface-border)] bg-[var(--surface-card)] px-3 text-sm text-slate-800 shadow-xs transition-colors outline-none focus-visible:border-[color:var(--focus-ring)] focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--focus-ring)_25%,transparent)]"
                                data-testid="select-phase"
                            >
                                {PROCESS_PHASES.map((phase) => (
                                    <option key={phase} value={phase}>{phase}</option>
                                ))}
                            </select>
                        </div>
                        {/* 体調チェック (UX-12) */}
                        <div>
                            <label className={fieldLabelClass}>今日の体調</label>
                            <div className="flex gap-2 mt-1">
                                {HEALTH_CONDITIONS.map((cond) => (
                                    <Button
                                        key={cond.value}
                                        variant={healthCondition === cond.value ? 'default' : 'outline'}
                                        onClick={() => setHealthCondition(cond.value)}
                                        className={`h-10 flex-1 rounded-lg ${
                                            healthCondition === cond.value
                                                ? 'bg-[var(--brand-600)] text-[var(--brand-foreground)] hover:bg-[var(--brand-700)]'
                                                : 'border-[color:var(--surface-border)] bg-[var(--surface-card)] text-slate-700 hover:bg-[var(--brand-50)]'
                                        }`}
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
                            className="h-12 w-full text-lg font-semibold bg-[var(--brand-600)] text-[var(--brand-foreground)] hover:bg-[var(--brand-700)]"
                            onClick={handleStart}
                            disabled={isStarting || !userName.trim() || !siteName.trim()}
                            data-testid="button-start-ky"
                        >
                            {isStarting ? '準備中...' : 'KY活動を開始'}
                        </Button>
                        <p className={helperTextClass}>
                            作業者名と現場名を入力すると開始できます。完了後は履歴に自動保存されます。
                        </p>
                    </CardContent>
                </Card>

                {/* 履歴ボタン (HIS-02) */}
                <Button
                    variant="outline"
                    className="h-12 w-full border-[color:var(--surface-border)] bg-[var(--surface-card)] text-[var(--accent-royal-600)] font-semibold shadow-xs hover:bg-[var(--brand-50)] hover:border-[color:var(--brand-200)]"
                    onClick={() => navigate('/history')}
                >
                    過去の記録を見る
                </Button>

                {/* 説明 */}
                <Card className="border-[color:var(--surface-border)] bg-[var(--surface-card)] py-3 shadow-sm">
                    <CardContent className="py-3">
                        <p className="text-sm text-[var(--text-muted)]">
                            AIアシスタントが対話形式でKY活動をサポートします。
                            作業内容、危険、対策を順番に入力していきます。
                        </p>
                    </CardContent>
                </Card>

            </div>
        </div >
    )
}

