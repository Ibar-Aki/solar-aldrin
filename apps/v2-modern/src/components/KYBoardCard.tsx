import { Card, CardContent } from '@/components/ui/card'
import type { CountermeasureCategory, WorkItem } from '@/types/ky'

type Props = {
    currentWorkItem: Partial<WorkItem>
    workItemIndex: number // 1-based
}

const CATEGORY_LABELS: Record<CountermeasureCategory, string> = {
    equipment: '設備・環境',
    behavior: '人配置・行動',
    ppe: '保護具',
}

function formatMultiline(values: Array<string | null | undefined> | null | undefined): string {
    const lines = (values ?? [])
        .map((v) => (typeof v === 'string' ? v.trim() : ''))
        .filter((v) => v.length > 0)
    return lines.join('\n')
}

function formatMeasuresByCategory(
    countermeasures: WorkItem['countermeasures'] | undefined,
    category: CountermeasureCategory
): string {
    const lines = (countermeasures ?? [])
        .filter((cm) => cm.category === category)
        .map((cm) => cm.text?.trim() ?? '')
        .filter((t) => t.length > 0)
    return lines.join('\n')
}

export function KYBoardCard({ currentWorkItem, workItemIndex }: Props) {
    const riskLabel = typeof currentWorkItem.riskLevel === 'number' ? String(currentWorkItem.riskLevel) : ''
    const whyText = formatMultiline(currentWorkItem.whyDangerous)

    const measures = currentWorkItem.countermeasures ?? []
    const equipmentText = formatMeasuresByCategory(measures, 'equipment')
    const behaviorText = formatMeasuresByCategory(measures, 'behavior')
    const ppeText = formatMeasuresByCategory(measures, 'ppe')

    return (
        <Card className="border-slate-200 bg-white/90 py-0 shadow-sm">
            <CardContent className="py-2 px-2 sm:px-3">
                <div className="text-sm font-bold text-slate-900 mb-1">KYボード</div>

                <div className="rounded border-2 border-slate-800 overflow-hidden bg-white">
                    {/* Hazard header */}
                    <div className="grid grid-cols-12 bg-slate-100 text-sm font-semibold text-slate-900">
                        <div className="col-span-8 px-2 py-1 border-r border-slate-800">
                            想定される危険【{workItemIndex}件目】
                        </div>
                        <div className="col-span-4 px-2 py-1 text-right">
                            危険度: {riskLabel}
                        </div>
                    </div>

                    {/* Hazard rows */}
                    <div className="grid grid-cols-12 border-t border-slate-800">
                        <div className="col-span-3 px-2 py-1 bg-slate-50 border-r border-slate-800 text-sm font-medium">
                            何をするとき
                        </div>
                        <div className="col-span-9 px-2 py-1 text-sm whitespace-pre-wrap break-words min-h-6">
                            {currentWorkItem.workDescription ?? ''}
                        </div>
                    </div>
                    <div className="grid grid-cols-12 border-t border-slate-800">
                        <div className="col-span-3 px-2 py-1 bg-slate-50 border-r border-slate-800 text-sm font-medium">
                            何が原因で
                        </div>
                        <div className="col-span-9 px-2 py-1 text-sm whitespace-pre-wrap break-words min-h-6">
                            {whyText}
                        </div>
                    </div>
                    <div className="grid grid-cols-12 border-t border-slate-800">
                        <div className="col-span-3 px-2 py-1 bg-slate-50 border-r border-slate-800 text-sm font-medium">
                            どうなる
                        </div>
                        <div className="col-span-9 px-2 py-1 text-sm whitespace-pre-wrap break-words min-h-6">
                            {currentWorkItem.hazardDescription ?? ''}
                        </div>
                    </div>

                    {/* Measures header */}
                    <div className="grid grid-cols-12 bg-slate-100 text-sm font-semibold text-slate-900 border-t-2 border-slate-800">
                        <div className="col-span-12 px-2 py-1">
                            危険への対策【{workItemIndex}件目】
                        </div>
                    </div>

                    {/* Measures rows */}
                    {([
                        { key: 'equipment' as const, value: equipmentText },
                        { key: 'behavior' as const, value: behaviorText },
                        { key: 'ppe' as const, value: ppeText },
                    ]).map((row) => (
                        <div key={row.key} className="grid grid-cols-12 border-t border-slate-800">
                            <div className="col-span-3 px-2 py-1 bg-amber-50 border-r border-slate-800 text-sm font-medium">
                                {CATEGORY_LABELS[row.key]}
                            </div>
                            <div className="col-span-9 px-2 py-1 bg-amber-50 text-sm whitespace-pre-wrap break-words min-h-6">
                                {row.value}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-1 text-xs text-slate-600">
                    対策は合計2件以上で保存されます（同じカテゴリ内で2件でもOK）。
                </div>
            </CardContent>
        </Card>
    )
}

