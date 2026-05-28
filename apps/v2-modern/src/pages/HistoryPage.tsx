/**
 * 履歴一覧ページ
 * Phase 2.3: HIS-02
 */
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import type { SoloKYSession } from '@/types/ky'
import { getAllSessions } from '@/lib/db'
import { exportToJSON, exportToCSV } from '@/lib/exportUtils'
import { formatDate } from '@/lib/dateUtils'
import { filterSessionsForHistory, type HistoryDateFilter } from '@/lib/historyFilters'
import { applyHistoryRetention, getHistoryRetentionPreview, type HistoryRetentionPreview } from '@/lib/historyUtils'

const DATE_FILTERS: Array<{ value: HistoryDateFilter; label: string }> = [
    { value: 'all', label: 'すべて' },
    { value: 'today', label: '今日' },
    { value: '7d', label: '7日' },
    { value: '30d', label: '30日' },
]

export function HistoryPage() {
    const navigate = useNavigate()
    const [sessions, setSessions] = useState<SoloKYSession[]>([])
    const [loading, setLoading] = useState(true)
    const [exporting, setExporting] = useState(false)
    const [query, setQuery] = useState('')
    const [dateFilter, setDateFilter] = useState<HistoryDateFilter>('all')
    const [retentionPreview, setRetentionPreview] = useState<HistoryRetentionPreview | null>(null)
    const [cleaning, setCleaning] = useState(false)

    useEffect(() => {
        loadSessions()
    }, [])

    async function loadSessions() {
        setLoading(true)
        try {
            const data = await getAllSessions()
            setSessions(data)
            setRetentionPreview(await getHistoryRetentionPreview())
        } catch (e) {
            console.error('Failed to load sessions:', e)
        } finally {
            setLoading(false)
        }
    }

    async function handleCleanupHistory() {
        setCleaning(true)
        try {
            const preview = await applyHistoryRetention()
            if (preview.deleteCount > 0) {
                await loadSessions()
            } else {
                setRetentionPreview(await getHistoryRetentionPreview())
            }
        } catch (e) {
            console.error('Failed to cleanup history:', e)
            alert('履歴整理に失敗しました')
        } finally {
            setCleaning(false)
        }
    }

    async function handleExportJSON() {
        setExporting(true)
        try {
            const success = await exportToJSON()
            if (!success) {
                alert('JSONエクスポートに失敗しました')
            }
        } finally {
            setExporting(false)
        }
    }

    async function handleExportCSV() {
        setExporting(true)
        try {
            const success = await exportToCSV()
            if (!success) {
                alert('CSVエクスポートに失敗しました')
            }
        } finally {
            setExporting(false)
        }
    }

    // FIX-08: formatDate はdateUtilsからインポート


    const filteredSessions = useMemo(() => filterSessionsForHistory(sessions, {
        query,
        dateFilter,
    }), [sessions, query, dateFilter])

    const hasRetentionTargets = Boolean(retentionPreview && retentionPreview.deleteCount > 0)

    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <div className="max-w-md mx-auto space-y-4 pt-4">
                {/* ヘッダー */}
                <Card>
                    <CardHeader className="py-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-xl text-blue-600">履歴一覧</CardTitle>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate('/')}
                            >
                                戻る
                            </Button>
                        </div>
                    </CardHeader>
                </Card>

                {/* エクスポートボタン */}
                {sessions.length > 0 && (
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExportCSV}
                            disabled={exporting}
                            className="flex-1"
                        >
                            CSV出力
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExportJSON}
                            disabled={exporting}
                            className="flex-1"
                        >
                            JSON出力
                        </Button>
                    </div>
                )}

                {hasRetentionTargets && retentionPreview && (
                    <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                        <AlertDescription>
                            <div className="space-y-2">
                                <p>
                                    整理候補が{retentionPreview.deleteCount}件あります。
                                    {retentionPreview.retentionDays}日超または{retentionPreview.maxSessions}件超の記録です。
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="w-full border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                                    onClick={handleCleanupHistory}
                                    disabled={cleaning || exporting}
                                >
                                    {cleaning ? '整理中...' : 'エクスポート後に履歴を整理'}
                                </Button>
                            </div>
                        </AlertDescription>
                    </Alert>
                )}

                {sessions.length > 0 && (
                    <Card>
                        <CardContent className="space-y-3 py-4">
                            <Input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="現場名・工程・危険・対策で検索"
                                data-testid="input-history-search"
                            />
                            <div className="grid grid-cols-4 gap-2">
                                {DATE_FILTERS.map((filter) => (
                                    <Button
                                        key={filter.value}
                                        type="button"
                                        size="sm"
                                        variant={dateFilter === filter.value ? 'default' : 'outline'}
                                        onClick={() => setDateFilter(filter.value)}
                                        data-testid={`button-history-filter-${filter.value}`}
                                    >
                                        {filter.label}
                                    </Button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* ローディング */}
                {loading && (
                    <Card>
                        <CardContent className="py-8 text-center text-gray-500">
                            読み込み中...
                        </CardContent>
                    </Card>
                )}

                {/* 履歴なし */}
                {!loading && sessions.length === 0 && (
                    <Card>
                        <CardContent className="py-8 text-center text-gray-500">
                            まだ履歴がありません。
                            <br />
                            KY活動を完了すると、ここに記録されます。
                        </CardContent>
                    </Card>
                )}

                {!loading && sessions.length > 0 && filteredSessions.length === 0 && (
                    <Card>
                        <CardContent className="py-8 text-center text-gray-500">
                            条件に合う履歴がありません。
                        </CardContent>
                    </Card>
                )}

                {/* 履歴リスト */}
                {!loading && filteredSessions.map((session) => (
                    <Card
                        key={session.id}
                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => navigate(`/history/${session.id}`)}
                    >
                        <CardContent className="py-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-medium text-gray-900">
                                        {session.siteName}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        {session.userName} / 作業{session.workItems.length}件
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-gray-500">
                                        {formatDate(session.createdAt)}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        {session.weather}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {/* 件数表示 */}
                {!loading && sessions.length > 0 && (
                    <p className="text-center text-sm text-gray-500">
                        表示{filteredSessions.length}件 / 全{sessions.length}件
                    </p>
                )}
            </div>
        </div>
    )
}
