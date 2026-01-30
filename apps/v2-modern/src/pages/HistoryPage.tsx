/**
 * 履歴一覧ページ
 * Phase 2.3: HIS-02
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SoloKYSession } from '@/types/ky'
import { getAllSessions } from '@/lib/db'
import { exportToJSON, exportToCSV } from '@/lib/exportUtils'
import { formatDate } from '@/lib/dateUtils'

export function HistoryPage() {
    const navigate = useNavigate()
    const [sessions, setSessions] = useState<SoloKYSession[]>([])
    const [loading, setLoading] = useState(true)
    const [exporting, setExporting] = useState(false)

    useEffect(() => {
        loadSessions()
    }, [])

    async function loadSessions() {
        setLoading(true)
        try {
            const data = await getAllSessions()
            setSessions(data)
        } catch (e) {
            console.error('Failed to load sessions:', e)
        } finally {
            setLoading(false)
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

                {/* 履歴リスト */}
                {!loading && sessions.map((session) => (
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
                        全{sessions.length}件
                    </p>
                )}
            </div>
        </div>
    )
}
