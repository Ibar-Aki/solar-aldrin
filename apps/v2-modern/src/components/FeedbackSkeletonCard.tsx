import { Card, CardContent, CardHeader } from '@/components/ui/card'

export function FeedbackSkeletonCard() {
    return (
        <Card className="animate-pulse">
            <CardHeader className="py-3">
                <div className="h-4 w-32 bg-gray-200 rounded" />
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="h-12 bg-gray-200 rounded" />
                <div className="h-12 bg-gray-200 rounded" />
            </CardContent>
        </Card>
    )
}
