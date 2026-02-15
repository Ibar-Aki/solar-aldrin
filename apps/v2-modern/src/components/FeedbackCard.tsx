import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { FeedbackSummary } from '@/types/ky'

interface FeedbackCardProps {
    feedback: FeedbackSummary
}

export function FeedbackCard({ feedback }: FeedbackCardProps) {
    return (
        <Card className="gap-2.5 py-3">
            <CardHeader className="py-1.5">
                <CardTitle className="text-base leading-none">今日のフィードバック</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pt-0">
                <div className="bg-emerald-50 p-2 rounded-lg">
                    <p className="text-sm font-semibold text-emerald-700">👏 今日のよかったところ</p>
                    <p className="text-sm text-emerald-900 mt-0.5 leading-tight">{feedback.praise}</p>
                </div>
                <div className="bg-blue-50 p-2 rounded-lg">
                    <p className="text-sm font-semibold text-blue-700">💡 次回へのヒント</p>
                    <p className="text-sm text-blue-900 mt-0.5 leading-tight">{feedback.tip}</p>
                </div>
            </CardContent>
        </Card>
    )
}
