import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { PolishedGoal } from '@/types/ky'

interface GoalPolishCardProps {
    polishedGoal: PolishedGoal
    adopted: boolean
    onAdopt: () => void
    onKeepOriginal: () => void
}

export function GoalPolishCard({ polishedGoal, adopted, onAdopt, onKeepOriginal }: GoalPolishCardProps) {
    return (
        <Card>
            <CardHeader className="py-3">
                <CardTitle className="text-base">行動目標のブラッシュアップ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-500">Before</p>
                    <p className="text-sm font-semibold text-gray-800 mt-1">{polishedGoal.original}</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-xs text-blue-600">After</p>
                    <p className="text-sm font-semibold text-blue-800 mt-1">{polishedGoal.polished}</p>
                </div>

                <div className="flex gap-2">
                    <Button
                        className="flex-1"
                        onClick={onAdopt}
                        disabled={adopted}
                    >
                        {adopted ? '採用済み' : '採用する'}
                    </Button>
                    <Button
                        variant="outline"
                        className="flex-1"
                        onClick={onKeepOriginal}
                    >
                        元のままでOK
                    </Button>
                </div>
                {adopted && (
                    <p className="text-xs text-green-600">採用した目標がPDFに反映されます。</p>
                )}
            </CardContent>
        </Card>
    )
}
