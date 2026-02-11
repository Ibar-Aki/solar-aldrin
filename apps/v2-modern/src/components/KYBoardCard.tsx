import { Card, CardContent } from '@/components/ui/card'
import type { CountermeasureCategory, WorkItem } from '@/types/ky'
import { isHazardSectionComplete } from '@/lib/validation'

type Props = {
    currentWorkItem: Partial<WorkItem>
    workItemIndex: number // 1-based
}

const CATEGORY_LABELS: Record<CountermeasureCategory, string> = {
    equipment: '設備・環境',
    behavior: '配置・行動',
    ppe: '保護具',
}

const FIRST_WORK_ITEM_PLACEHOLDERS = {
    workDescription: '例）脚立上で天井配線を固定する時',
    whyDangerous: '例）脚立の設置角度が不適切で足元が滑りやすいため',
    hazardDescription: '例）バランスを崩して墜落し、頭部を負傷する',
} as const

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
    const isHazardCompleted = isHazardSectionComplete(currentWorkItem)
    const isFirstWorkItem = workItemIndex === 1

    const measures = currentWorkItem.countermeasures ?? []
    const equipmentText = formatMeasuresByCategory(measures, 'equipment')
    const behaviorText = formatMeasuresByCategory(measures, 'behavior')
    const ppeText = formatMeasuresByCategory(measures, 'ppe')

    const workDescriptionText = (currentWorkItem.workDescription ?? '').trim()
    const whyDangerousText = whyText.trim()
    const hazardDescriptionText = (currentWorkItem.hazardDescription ?? '').trim()

    return (
        <Card className="border-slate-200 bg-white/90 py-0 shadow-sm">
            <CardContent className="py-1.5 px-1.5 sm:py-2 sm:px-3">
                <div className="mb-1 flex items-center justify-between text-sm font-bold text-slate-900">
                    <span>KYボード</span>
                    <span className="text-slate-800">【{workItemIndex}件目】</span>
                </div>

                <div className="rounded border-2 border-slate-800 overflow-hidden bg-white">
                    {/* Hazard header */}
                    <div className="grid grid-cols-12 bg-slate-100 text-[13px] sm:text-sm font-semibold text-slate-900">
                        <div className="col-span-8 px-1.5 py-1 sm:px-2 border-r border-slate-800">
                            想定される危険
                        </div>
                        <div className="col-span-4 px-1.5 py-1 sm:px-2 text-left sm:text-right">
                            危険度: {riskLabel}
                        </div>
                    </div>

                    {/* Hazard rows */}
                    <div className="grid grid-cols-12 border-t border-slate-800">
                        <div className="col-span-5 sm:col-span-4 px-1.5 py-0.5 sm:px-2 sm:py-1 bg-slate-50 border-r border-slate-800 text-[13px] sm:text-sm font-medium">
                            何をする時
                        </div>
                        <div className="col-span-7 sm:col-span-8 px-1.5 py-0.5 sm:px-2 sm:py-1 text-[13px] sm:text-sm whitespace-pre-wrap break-words min-h-6">
                            {workDescriptionText || (
                                isFirstWorkItem ? <span className="text-slate-400">{FIRST_WORK_ITEM_PLACEHOLDERS.workDescription}</span> : ''
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-12 border-t border-slate-800">
                        <div className="col-span-5 sm:col-span-4 px-1.5 py-0.5 sm:px-2 sm:py-1 bg-slate-50 border-r border-slate-800 text-[13px] sm:text-sm font-medium">
                            何が原因で
                        </div>
                        <div className="col-span-7 sm:col-span-8 px-1.5 py-0.5 sm:px-2 sm:py-1 text-[13px] sm:text-sm whitespace-pre-wrap break-words min-h-6">
                            {whyDangerousText || (
                                isFirstWorkItem ? <span className="text-slate-400">{FIRST_WORK_ITEM_PLACEHOLDERS.whyDangerous}</span> : ''
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-12 border-t border-slate-800">
                        <div className="col-span-5 sm:col-span-4 px-1.5 py-0.5 sm:px-2 sm:py-1 bg-slate-50 border-r border-slate-800 text-[13px] sm:text-sm font-medium">
                            どうなる
                        </div>
                        <div className="col-span-7 sm:col-span-8 px-1.5 py-0.5 sm:px-2 sm:py-1 text-[13px] sm:text-sm whitespace-pre-wrap break-words min-h-6">
                            {hazardDescriptionText || (
                                isFirstWorkItem ? <span className="text-slate-400">{FIRST_WORK_ITEM_PLACEHOLDERS.hazardDescription}</span> : ''
                            )}
                        </div>
                    </div>

                    {isHazardCompleted && (
                        <>
                            {/* Measures header */}
                            <div className="grid grid-cols-12 bg-amber-50 text-[13px] sm:text-sm font-semibold text-slate-900 border-t-2 border-slate-800">
                                <div className="col-span-12 px-1.5 py-1 sm:px-2">
                                    危険への対策（対策は2件以上が必要です）
                                </div>
                            </div>

                            {/* Measures rows */}
                            {([
                                { key: 'equipment' as const, value: equipmentText },
                                { key: 'behavior' as const, value: behaviorText },
                                { key: 'ppe' as const, value: ppeText },
                            ]).map((row) => (
                                <div key={row.key} className="grid grid-cols-12 border-t border-slate-800">
                                    <div className="col-span-5 sm:col-span-4 px-1.5 py-0.5 sm:px-2 sm:py-1 bg-amber-50 border-r border-slate-800 text-[13px] sm:text-sm font-medium">
                                        {CATEGORY_LABELS[row.key]}
                                    </div>
                                    <div className="col-span-7 sm:col-span-8 px-1.5 py-0.5 sm:px-2 sm:py-1 bg-amber-50 text-[13px] sm:text-sm whitespace-pre-wrap break-words min-h-6">
                                        {row.value}
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
