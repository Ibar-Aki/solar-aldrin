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

type SegmentLevel = 'unrated' | 'small' | 'medium' | 'large'

type SegmentVisual = {
    level: SegmentLevel
    label: '未' | '小' | '中' | '大'
    barWidthClass: string
    barColorClass: string
    labelColorClass: string
}

function resolveSegmentVisual(rawValue: string | null | undefined): SegmentVisual {
    const source = rawValue ?? ''
    const trimmed = source.trim()
    if (!trimmed) {
        return {
            level: 'unrated',
            label: '未',
            barWidthClass: 'w-8',
            barColorClass: 'bg-slate-300',
            labelColorClass: 'text-slate-500',
        }
    }

    const length = source.length
    if (length <= 5) {
        return {
            level: 'small',
            label: '小',
            barWidthClass: 'w-6',
            barColorClass: 'bg-red-500',
            labelColorClass: 'text-red-600',
        }
    }
    if (length <= 9) {
        return {
            level: 'medium',
            label: '中',
            barWidthClass: 'w-10',
            barColorClass: 'bg-amber-500',
            labelColorClass: 'text-amber-600',
        }
    }
    return {
        level: 'large',
        label: '大',
        barWidthClass: 'w-14',
        barColorClass: 'bg-emerald-500',
        labelColorClass: 'text-emerald-600',
    }
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
    const isHazardCompleted = isHazardSectionComplete(currentWorkItem)
    const isFirstWorkItem = workItemIndex === 1

    const measures = currentWorkItem.countermeasures ?? []
    const equipmentText = formatMeasuresByCategory(measures, 'equipment')
    const behaviorText = formatMeasuresByCategory(measures, 'behavior')
    const ppeText = formatMeasuresByCategory(measures, 'ppe')

    const workDescriptionText = (currentWorkItem.workDescription ?? '').trim()
    const whyDangerousText = whyText.trim()
    const hazardDescriptionText = (currentWorkItem.hazardDescription ?? '').trim()
    const workSpecificity = resolveSegmentVisual(currentWorkItem.workDescription)
    const whyDetail = resolveSegmentVisual((currentWorkItem.whyDangerous ?? []).join('\n'))
    const hasHazardDescription = hazardDescriptionText.length > 0

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
                        <div className="relative col-span-5 sm:col-span-4 px-1.5 py-0.5 sm:px-2 sm:py-1 bg-slate-50 border-r border-slate-800 text-[13px] sm:text-sm font-medium">
                            何をする時
                            <div className="absolute bottom-0.5 right-1.5 text-right" data-testid="segment-work-description">
                                <div className="text-[10px] leading-none text-slate-500">具体性</div>
                                <div className="mt-0.5 flex items-center justify-end gap-1">
                                    <span
                                        className={`text-[10px] font-semibold leading-none ${workSpecificity.labelColorClass}`}
                                        data-testid="segment-work-description-label"
                                    >
                                        {workSpecificity.label}
                                    </span>
                                    <span
                                        className={`h-1.5 rounded-full ${workSpecificity.barWidthClass} ${workSpecificity.barColorClass}`}
                                        data-testid="segment-work-description-bar"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="col-span-7 sm:col-span-8 px-1.5 py-0.5 sm:px-2 sm:py-1 text-[13px] sm:text-sm whitespace-pre-wrap break-words min-h-6">
                            {workDescriptionText || (
                                isFirstWorkItem ? <span className="text-slate-400">{FIRST_WORK_ITEM_PLACEHOLDERS.workDescription}</span> : ''
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-12 border-t border-slate-800">
                        <div className="relative col-span-5 sm:col-span-4 px-1.5 py-0.5 sm:px-2 sm:py-1 bg-slate-50 border-r border-slate-800 text-[13px] sm:text-sm font-medium">
                            何が原因で
                            <div className="absolute bottom-0.5 right-1.5 text-right" data-testid="segment-why-dangerous">
                                <div className="text-[10px] leading-none text-slate-500">詳細度</div>
                                <div className="mt-0.5 flex items-center justify-end gap-1">
                                    <span
                                        className={`text-[10px] font-semibold leading-none ${whyDetail.labelColorClass}`}
                                        data-testid="segment-why-dangerous-label"
                                    >
                                        {whyDetail.label}
                                    </span>
                                    <span
                                        className={`h-1.5 rounded-full ${whyDetail.barWidthClass} ${whyDetail.barColorClass}`}
                                        data-testid="segment-why-dangerous-bar"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="col-span-7 sm:col-span-8 px-1.5 py-0.5 sm:px-2 sm:py-1 text-[13px] sm:text-sm whitespace-pre-wrap break-words min-h-6">
                            {whyDangerousText || (
                                isFirstWorkItem ? <span className="text-slate-400">{FIRST_WORK_ITEM_PLACEHOLDERS.whyDangerous}</span> : ''
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-12 border-t border-slate-800">
                        <div className="relative col-span-5 sm:col-span-4 px-1.5 py-0.5 sm:px-2 sm:py-1 bg-slate-50 border-r border-slate-800 text-[13px] sm:text-sm font-medium">
                            どうなる
                            {hasHazardDescription && (
                                <span
                                    className="absolute bottom-0.5 right-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white"
                                    data-testid="segment-hazard-description-check"
                                    aria-label="どうなる入力済み"
                                >
                                    ✓
                                </span>
                            )}
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
