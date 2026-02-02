import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { FeedbackSummary } from '@/types/ky'

interface FeedbackCardProps {
    feedback: FeedbackSummary
}

export function FeedbackCard({ feedback }: FeedbackCardProps) {
    return (
        <Card>
            <CardHeader className="py-3">
                <CardTitle className="text-base">今日のフィードバック</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="bg-emerald-50 p-3 rounded-lg">
                    <p className="text-sm font-semibold text-emerald-700">👏 今日のよかったところ</p>
                    <p className="text-sm text-emerald-900 mt-1">{feedback.praise}</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm font-semibold text-blue-700">💡 次回へのヒント</p>
                    <p className="text-sm text-blue-900 mt-1">{feedback.tip}</p>
                </div>
            </CardContent>
        </Card>
    )
}
