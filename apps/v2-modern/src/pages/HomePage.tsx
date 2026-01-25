import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useKYStore } from '@/stores/kyStore'

export function HomePage() {
    const navigate = useNavigate()
    const { session, startSession, clearSession } = useKYStore()

    const [userName, setUserName] = useState('')
    const [siteName, setSiteName] = useState('')
    const [weather, setWeather] = useState('晴れ')
    const [isStarting, setIsStarting] = useState(false)

    const handleStart = async () => {
        if (!userName.trim() || !siteName.trim()) return

        setIsStarting(true)
        try {
            startSession(userName.trim(), siteName.trim(), weather)
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
                        <CardHeader className="text-center">
                            <CardTitle className="text-2xl font-bold text-blue-600">
                                Voice KY Assistant
                            </CardTitle>
                            <CardDescription>v2 - 一人KY活動</CardDescription>
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
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl font-bold text-blue-600">
                            Voice KY Assistant
                        </CardTitle>
                        <CardDescription>
                            v2 - 一人KY活動
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
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">現場名</label>
                            <Input
                                value={siteName}
                                onChange={(e) => setSiteName(e.target.value)}
                                placeholder="例：〇〇ビル改修工事"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">天候</label>
                            <select
                                value={weather}
                                onChange={(e) => setWeather(e.target.value)}
                                className="mt-1 w-full border rounded-md p-2"
                            >
                                <option value="晴れ">晴れ</option>
                                <option value="曇り">曇り</option>
                                <option value="雨">雨</option>
                                <option value="雪">雪</option>
                                <option value="強風">強風</option>
                            </select>
                        </div>
                        <Button
                            className="w-full h-12 text-lg"
                            onClick={handleStart}
                            disabled={isStarting || !userName.trim() || !siteName.trim()}
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
            </div>
        </div>
    )
}
