import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SupplementItem } from '@/types/ky'

interface SupplementCardProps {
    supplements: SupplementItem[]
}

export function SupplementCard({ supplements }: SupplementCardProps) {
    return (
        <Card className="gap-2.5 py-3">
            <CardHeader className="py-1.5">
                <CardTitle className="text-base leading-none">AI補足</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pt-0">
                {supplements.map((item, index) => (
                    <div key={`${item.risk}-${index}`} className="border border-dashed border-indigo-200 bg-indigo-50/40 p-2.5 rounded-lg">
                        <p className="text-sm font-semibold text-indigo-700">このリスクも忘れずに</p>
                        <p className="text-sm text-indigo-900 mt-0.5 leading-tight">{item.risk}</p>
                        <p className="text-xs text-indigo-600 mt-1 leading-tight">対策: {item.measure}</p>
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}
