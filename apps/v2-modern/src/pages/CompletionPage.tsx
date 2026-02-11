import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, CheckCircle2, Download, Home } from 'lucide-react'
import { useKYStore } from '@/stores/kyStore'
import { usePDFGenerator } from '@/hooks/usePDFGenerator'
import { FanfareManager, type FanfarePattern } from '@/components/fanfare/FanfareManager'
import { FeedbackCard } from '@/components/FeedbackCard'
import { SupplementCard } from '@/components/SupplementCard'
import { GoalPolishCard } from '@/components/GoalPolishCard'
import { FeedbackSkeletonCard } from '@/components/FeedbackSkeletonCard'
import { postFeedback } from '@/lib/api'
import { getClientId } from '@/lib/clientId'
import { RecentRiskBadge } from '@/components/RecentRiskBadge'
import { getRecentRiskMatches, type RecentRiskMatch } from '@/lib/historyUtils'
import { getApiToken } from '@/lib/apiToken'
import { shouldRequireApiTokenClient } from '@/lib/envFlags'

const FALLBACK_FEEDBACK = {
    praise: '今日のKYは要点が押さえられていて良い取り組みです。',
    tip: '次回は作業順序の確認を一言添えるとさらに良くなります。今の視点は十分に良いです。',
}

export function CompletionPage() {
    const navigate = useNavigate()
    const {
        session,
        status,
        clearSession,
        saveSessionToDb,
        messages,
        feedback,
        supplements,
        polishedGoal,
        polishedActionGoal,
        feedbackLoading,
        feedbackSessionId,
        setFeedbackResult,
        setPolishedActionGoal,
        setFeedbackLoading,
        setFeedbackError,
    } = useKYStore()
    const { generateAndDownload, isGenerating } = usePDFGenerator()

    const shouldAutoFanfare = !!session && status === 'completed'

    // ファンファーレ状態管理
    const [fanfarePattern, setFanfarePattern] = useState<FanfarePattern>(() => (
        shouldAutoFanfare ? 'spotlight' : 'none'
    ))
    const [isFanfareActive, setIsFanfareActive] = useState(() => shouldAutoFanfare)
    const [showSkeleton, setShowSkeleton] = useState(false)
    const [recentRisks, setRecentRisks] = useState<RecentRiskMatch[]>([])
    const [recentRiskLoading, setRecentRiskLoading] = useState(false)

    // FIX-03: useRefで保存試行をガード（依存配列問題を回避）
    const saveAttemptedRef = useRef(false)
    const feedbackAttemptedRef = useRef<string | null>(null)
    const feedbackAbortRef = useRef<AbortController | null>(null)

    // セッション完了時にスポットライトを自動再生 & DB保存
    useEffect(() => {
        if (!session) {
            navigate('/')
            return
        }
        if (status !== 'completed') {
            navigate('/session')
            return
        }

        // IndexedDBに保存（一度だけ）
        if (saveAttemptedRef.current) return
        saveAttemptedRef.current = true
        void saveSessionToDb().then((success) => {
            if (success && import.meta.env.DEV) console.log('Session saved to history')
        })
    }, [session, status, navigate, saveSessionToDb])

    useEffect(() => {
        if (!feedbackLoading) {
            setShowSkeleton(false)
            return
        }
        const timer = setTimeout(() => setShowSkeleton(true), 300)
        return () => clearTimeout(timer)
    }, [feedbackLoading])

    useEffect(() => {
        if (!session || status !== 'completed') return
        if (feedbackSessionId === session.id) return
        if (feedbackAttemptedRef.current === session.id) return
        const applyFallback = () => {
            setFeedbackResult({
                feedback: FALLBACK_FEEDBACK,
                supplements: [],
                polishedGoal: null,
                sessionId: session.id,
            })
        }

        const feedbackEnabled = import.meta.env.VITE_ENABLE_FEEDBACK !== '0'
        if (!feedbackEnabled) {
            feedbackAttemptedRef.current = session.id
            setFeedbackLoading(false)
            applyFallback()
            return
        }

        const requireAuth = shouldRequireApiTokenClient()
        const hasToken = Boolean(getApiToken())
        if (requireAuth && !hasToken) {
            setFeedbackError('APIトークンが設定されていません（ホーム画面の「APIトークン設定」を確認してください）')
            feedbackAttemptedRef.current = session.id
            setFeedbackLoading(false)
            applyFallback()
            return
        }

        const sanitizeText = (value: string, maxLen: number) => value.trim().slice(0, maxLen)
        const maskKeywords = [session.userName, session.siteName].filter(Boolean)
        const maskSensitive = (value: string) => {
            let masked = value
            for (const keyword of maskKeywords) {
                masked = masked.split(keyword).join('[redacted]')
            }
            masked = masked.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
            masked = masked.replace(/\b0\d{1,4}-\d{1,4}-\d{3,4}\b/g, '[phone]')
            masked = masked.replace(/\b\d{7,}\b/g, '[number]')
            return masked
        }
        const normalizeList = (values: Array<string | null | undefined>, maxItems: number, maxLen: number) => {
            const list = values
                .map((v) => (v ? sanitizeText(maskSensitive(v), maxLen) : ''))
                .filter((v) => v.length > 0)
            return list.slice(0, maxItems)
        }

        const workSummary = sanitizeText(
            normalizeList(
                session.workItems.map((item) => item.workDescription),
                5,
                120
            ).join(' / '),
            200
        )

        const digestSource = messages
            .filter((msg) => msg.role !== 'system')
            .slice(-6)
            .map((msg) => {
                const role = msg.role === 'user' ? 'U' : 'A'
                return `${role}: ${sanitizeText(maskSensitive(msg.content), 200)}`
            })
        const chatDigest = digestSource.length > 0
            ? digestSource.join('\n').slice(0, 1200)
            : undefined

        const request = {
            sessionId: session.id,
            clientId: getClientId(),
            context: {
                work: workSummary || undefined,
                location: session.siteName ? sanitizeText(maskSensitive(session.siteName), 120) : undefined,
                weather: session.weather ? sanitizeText(maskSensitive(session.weather), 60) : undefined,
                processPhase: session.processPhase ? sanitizeText(session.processPhase, 40) : undefined,
                healthCondition: session.healthCondition ? sanitizeText(session.healthCondition, 40) : undefined,
            },
            extracted: {
                risks: normalizeList(session.workItems.map((item) => item.hazardDescription), 20, 120),
                measures: normalizeList(session.workItems.flatMap((item) => item.countermeasures.map((cm) => cm.text)), 20, 120),
                actionGoal: session.actionGoal ? sanitizeText(maskSensitive(session.actionGoal), 120) : undefined,
            },
            chatDigest,
        }

        const controller = new AbortController()
        feedbackAbortRef.current = controller
        feedbackAttemptedRef.current = session.id

        const run = async () => {
            setFeedbackLoading(true)
            setFeedbackError(null)
            try {
                const result = await postFeedback(request, { signal: controller.signal })
                if (!result) {
                    applyFallback()
                    return
                }
                setFeedbackResult({
                    feedback: { praise: result.praise, tip: result.tip },
                    supplements: result.supplements,
                    polishedGoal: result.polishedGoal,
                    sessionId: session.id,
                })
            } catch (e) {
                console.error('Feedback error:', e)
                setFeedbackError(e instanceof Error ? e.message : 'フィードバック取得に失敗しました')
                applyFallback()
            } finally {
                setFeedbackLoading(false)
            }
        }

        void run()

        return () => {
            controller.abort()
        }
    }, [
        session,
        status,
        feedbackSessionId,
        setFeedbackResult,
        setFeedbackLoading,
        setFeedbackError,
        messages,
    ])

    useEffect(() => {
        if (!session || status !== 'completed') return

        const contextEnabled = import.meta.env.VITE_ENABLE_CONTEXT_INJECTION !== '0'
        if (!contextEnabled) {
            setRecentRisks([])
            return
        }

        let cancelled = false
        setRecentRiskLoading(true)

        const run = async () => {
            try {
                const matches = await getRecentRiskMatches(session, 3)
                if (!cancelled) {
                    setRecentRisks(matches)
                }
            } catch (error) {
                console.error('Failed to load recent risks:', error)
            } finally {
                if (!cancelled) {
                    setRecentRiskLoading(false)
                }
            }
        }

        void run()

        return () => {
            cancelled = true
        }
    }, [session, status])

    const handleDownload = async () => {
        if (!session) return
        const pdfFeedback = feedback ?? null
        const pdfSupplements = supplements
        const actionGoalOverride = polishedActionGoal ?? null
        await generateAndDownload(session, {
            feedback: pdfFeedback,
            supplements: pdfSupplements,
            actionGoalOverride,
            recentRisks,
        })
    }

    const handleHome = () => {
        clearSession()
        navigate('/')
    }

    const handleAdoptPolish = () => {
        if (!polishedGoal) return
        setPolishedActionGoal(polishedGoal.polished)
    }

    const handleKeepOriginal = () => {
        setPolishedActionGoal(null)
    }

    const playFanfare = (pattern: FanfarePattern) => {
        setFanfarePattern(pattern)
        setIsFanfareActive(false)
        // リセットしてから再生
        setTimeout(() => {
            setIsFanfareActive(true)
        }, 50)
    }

    if (!session || status !== 'completed') return null

    const displayActionGoal = polishedActionGoal ?? session.actionGoal

    const hasFeedback = Boolean(feedback && feedback.praise && feedback.tip)
    const hasSupplements = supplements.length > 0
    const hasPolish = Boolean(polishedGoal && polishedGoal.polished)
    const showFeedbackSection = feedbackLoading || hasFeedback || hasSupplements || hasPolish

    const getRecentRiskLabel = (daysAgo: number) => {
        if (daysAgo <= 0) return '本日も指摘されました'
        if (daysAgo === 1) return '昨日も指摘されました'
        return '直近3日以内に指摘されました'
    }

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
                                {displayActionGoal || '（未設定）'}
                            </p>
                            <p className="text-sm text-blue-600 mt-2 font-bold">
                                ヨシ！
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* 直近の繰り返し危険 */}
                {!recentRiskLoading && recentRisks.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">最近も挙がった危険</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {recentRisks.map((risk) => (
                                <div key={`${risk.risk}-${risk.date}`} className="space-y-1">
                                    <RecentRiskBadge label={getRecentRiskLabel(risk.daysAgo)} />
                                    <p className="text-sm font-medium text-gray-900">{risk.risk}</p>
                                    <p className="text-xs text-gray-500">前回: {risk.date.slice(0, 10)}</p>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}

                {/* フィードバック */}
                {showFeedbackSection && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-500">事後フィードバック</p>
                        </div>

                        {feedbackLoading && showSkeleton && (
                            <>
                                <FeedbackSkeletonCard />
                                <FeedbackSkeletonCard />
                            </>
                        )}

                        {!feedbackLoading && hasFeedback && feedback && (
                            <FeedbackCard feedback={feedback} />
                        )}

                        {!feedbackLoading && hasSupplements && (
                            <SupplementCard supplements={supplements} />
                        )}

                        {!feedbackLoading && hasPolish && polishedGoal && (
                            <GoalPolishCard
                                polishedGoal={polishedGoal}
                                adopted={Boolean(polishedActionGoal)}
                                onAdopt={handleAdoptPolish}
                                onKeepOriginal={handleKeepOriginal}
                            />
                        )}
                    </div>
                )}

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
