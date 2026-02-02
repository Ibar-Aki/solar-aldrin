import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SupplementItem } from '@/types/ky'

interface SupplementCardProps {
    supplements: SupplementItem[]
}

export function SupplementCard({ supplements }: SupplementCardProps) {
    return (
        <Card>
            <CardHeader className="py-3">
                <CardTitle className="text-base">AI補足</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {supplements.map((item, index) => (
                    <div key={`${item.risk}-${index}`} className="border border-dashed border-indigo-200 bg-indigo-50/40 p-3 rounded-lg">
                        <p className="text-sm font-semibold text-indigo-700">このリスクも忘れずに</p>
                        <p className="text-sm text-indigo-900 mt-1">{item.risk}</p>
                        <p className="text-xs text-indigo-600 mt-2">対策: {item.measure}</p>
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}
