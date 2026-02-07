/**
 * 履歴詳細ページ
 * Phase 2.3: HIS-02, HIS-03
 */
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { SoloKYSession } from '@/types/ky'
import { getSessionById, deleteSession } from '@/lib/db'
import { formatDateLong } from '@/lib/dateUtils'
import { HEALTH_CONDITION_LABELS } from '@/constants/ky'

export function HistoryDetailPage() {
    const navigate = useNavigate()
    const { id } = useParams<{ id: string }>()
    const [session, setSession] = useState<SoloKYSession | null>(null)
    const [loading, setLoading] = useState(true)
    const [deleting, setDeleting] = useState(false)

    useEffect(() => {
        if (id) {
            loadSession(id)
        }
    }, [id])

    async function loadSession(sessionId: string) {
        setLoading(true)
        try {
            const data = await getSessionById(sessionId)
            setSession(data ?? null)
        } catch (e) {
            console.error('Failed to load session:', e)
        } finally {
            setLoading(false)
        }
    }

    async function handleDelete() {
        if (!session) return
        if (!confirm('この記録を削除しますか？\n削除すると元に戻せません。')) return

        setDeleting(true)
        try {
            await deleteSession(session.id)
            // レビュー指摘: 削除後は一覧に戻る
            navigate('/history', { replace: true })
        } catch (e) {
            console.error('Failed to delete session:', e)
            alert('削除に失敗しました')
        } finally {
            setDeleting(false)
        }
    }

    function handleCopyToNew() {
        if (!session) return
        // HIS-03: 基本情報のみコピー（危険・対策はコピーしない）
        navigate('/', {
            state: {
                prefill: {
                    siteName: session.siteName,
                    userName: session.userName,
                    weather: session.weather,
                    processPhase: session.processPhase,
                    // レビュー指摘: healthCondition も意図的に含める
                    healthCondition: session.healthCondition,
                }
            }
        })
    }

    // FIX-08: formatDateLong はdateUtilsからインポート
    const formatDateTime = formatDateLong

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 p-4">
                <div className="max-w-md mx-auto pt-8 text-center text-gray-500">
                    読み込み中...
                </div>
            </div>
        )
    }

    if (!session) {
        return (
            <div className="min-h-screen bg-gray-50 p-4">
                <div className="max-w-md mx-auto space-y-4 pt-8">
                    <Alert>
                        <AlertDescription>
                            記録が見つかりません。削除された可能性があります。
                        </AlertDescription>
                    </Alert>
                    <Button onClick={() => navigate('/history')} className="w-full">
                        履歴一覧に戻る
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <div className="max-w-md mx-auto space-y-4 pt-4">
                {/* ヘッダー */}
                <Card>
                    <CardHeader className="py-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-xl text-blue-600">履歴詳細</CardTitle>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate('/history')}
                            >
                                戻る
                            </Button>
                        </div>
                        <CardDescription>
                            {formatDateTime(session.createdAt)}
                        </CardDescription>
                    </CardHeader>
                </Card>

                {/* 基本情報 */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-lg">基本情報</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500">現場名</span>
                            <span className="font-medium">{session.siteName}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">作業者</span>
                            <span>{session.userName}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">天候</span>
                            <span>{session.weather}</span>
                        </div>
                        {session.processPhase && (
                            <div className="flex justify-between">
                                <span className="text-gray-500">工程</span>
                                <span>{session.processPhase}</span>
                            </div>
                        )}
                        {session.healthCondition && (
                            <div className="flex justify-between">
                                <span className="text-gray-500">体調</span>
                                <span>
                                    {HEALTH_CONDITION_LABELS[session.healthCondition]}
                                </span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* 作業項目 */}
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-lg">作業項目 ({session.workItems.length}件)</CardTitle>
                    </CardHeader>
                        <CardContent className="space-y-4">
                            {session.workItems.map((item, index) => (
                                <div key={item.id} className="border-l-4 border-blue-400 pl-3 py-1">
                                    <p className="font-medium text-sm">
                                        {index + 1}. {item.workDescription}
                                    </p>
                                    <p className="text-xs text-red-600">
                                        危険: {item.hazardDescription}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        リスクレベル: {item.riskLevel}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        対策カテゴリ: 保護具{item.countermeasures.filter((cm) => cm.category === 'ppe').length}
                                        {' / '}行動{item.countermeasures.filter((cm) => cm.category === 'behavior').length}
                                        {' / '}設備・準備{item.countermeasures.filter((cm) => cm.category === 'equipment').length}
                                    </p>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                {/* 行動目標 */}
                {session.actionGoal && (
                    <Card>
                        <CardHeader className="py-3">
                            <CardTitle className="text-lg">行動目標</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm">{session.actionGoal}</p>
                        </CardContent>
                    </Card>
                )}

                {/* ヒヤリハット */}
                {session.hadNearMiss && session.nearMissNote && (
                    <Card className="border-yellow-400">
                        <CardHeader className="py-3">
                            <CardTitle className="text-lg text-yellow-600">ヒヤリハット</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm">{session.nearMissNote}</p>
                        </CardContent>
                    </Card>
                )}

                {/* アクションボタン */}
                <div className="space-y-2">
                    <Button
                        onClick={handleCopyToNew}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                        この記録を元に新規作成
                    </Button>
                    <Button
                        onClick={handleDelete}
                        variant="outline"
                        className="w-full text-red-600 border-red-300 hover:bg-red-50"
                        disabled={deleting}
                    >
                        {deleting ? '削除中...' : 'この記録を削除'}
                    </Button>
                </div>
            </div>
        </div>
    )
}
