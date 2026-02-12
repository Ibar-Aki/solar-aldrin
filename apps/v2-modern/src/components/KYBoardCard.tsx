import { Card, CardContent } from '@/components/ui/card'
import type { CountermeasureCategory, WorkItem } from '@/types/ky'
import { isHazardSectionComplete } from '@/lib/validation'

type Props = {
    currentWorkItem: Partial<WorkItem>
    workItemIndex: number // 1-based
    boardScale: 'expanded' | 'compact'
    onBoardScaleChange: (scale: 'expanded' | 'compact') => void
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

export function KYBoardCard({ currentWorkItem, workItemIndex, boardScale, onBoardScaleChange }: Props) {
    const isCompact = boardScale === 'compact'
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
    const boardTextClass = isCompact ? 'text-[12px] sm:text-[13px]' : 'text-[13px] sm:text-sm'
    const boardCellPaddingClass = isCompact ? 'px-1 py-0.5 sm:px-1.5 sm:py-0.5' : 'px-1.5 py-0.5 sm:px-2 sm:py-1'
    const boardHeaderPaddingClass = isCompact ? 'px-1 py-0.5 sm:px-1.5 sm:py-0.5' : 'px-1.5 py-1 sm:px-2'
    const segmentTitleClass = isCompact ? 'text-[9px] leading-none text-slate-500' : 'text-[10px] leading-none text-slate-500'
    const segmentLabelClass = isCompact ? 'text-[9px] font-semibold leading-none' : 'text-[10px] font-semibold leading-none'
    const segmentBarClass = isCompact ? 'h-1 rounded-full' : 'h-1.5 rounded-full'
    const checkClass = isCompact
        ? 'absolute bottom-0.5 right-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white'
        : 'absolute bottom-0.5 right-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white'

    return (
        <Card className="border-slate-200 bg-white/90 py-0 shadow-sm" data-testid="ky-board-card" data-scale={boardScale}>
            <CardContent className={isCompact ? 'px-1 py-1 sm:px-2 sm:py-1.5' : 'py-1.5 px-1.5 sm:py-2 sm:px-3'}>
                <div className={`mb-1 flex items-center justify-between font-bold text-slate-900 ${isCompact ? 'text-xs sm:text-sm' : 'text-sm'}`}>
                    <span>KYボード</span>
                    <div className="flex items-center gap-1.5">
                        <div className="inline-flex items-center rounded-md border border-slate-300 bg-slate-100 p-0.5">
                            <button
                                type="button"
                                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                                    boardScale === 'expanded' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                }`}
                                aria-pressed={boardScale === 'expanded'}
                                onClick={() => onBoardScaleChange('expanded')}
                                data-testid="ky-board-scale-expanded"
                            >
                                拡大
                            </button>
                            <button
                                type="button"
                                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                                    boardScale === 'compact' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                }`}
                                aria-pressed={boardScale === 'compact'}
                                onClick={() => onBoardScaleChange('compact')}
                                data-testid="ky-board-scale-compact"
                            >
                                縮小
                            </button>
                        </div>
                        <span className={isCompact ? 'text-xs text-slate-800' : 'text-slate-800'}>【{workItemIndex}件目】</span>
                    </div>
                </div>

                <div className="rounded border-2 border-slate-800 overflow-hidden bg-white">
                    {/* Hazard header */}
                    <div className={`grid grid-cols-12 bg-slate-100 font-semibold text-slate-900 ${boardTextClass}`}>
                        <div className={`col-span-8 border-r border-slate-800 ${boardHeaderPaddingClass}`}>
                            想定される危険
                        </div>
                        <div className={`col-span-4 text-left sm:text-right ${boardHeaderPaddingClass}`}>
                            危険度: {riskLabel}
                        </div>
                    </div>

                    {/* Hazard rows */}
                    <div className="grid grid-cols-12 border-t border-slate-800">
                        <div className={`relative col-span-5 sm:col-span-4 bg-slate-50 border-r border-slate-800 font-medium ${boardTextClass} ${boardCellPaddingClass}`}>
                            何をする時
                            <div className={`absolute text-right ${isCompact ? 'bottom-0.5 right-1' : 'bottom-0.5 right-1.5'}`} data-testid="segment-work-description">
                                <div className={segmentTitleClass}>具体性</div>
                                <div className="mt-px flex items-center justify-end gap-1">
                                    <span
                                        className={`${segmentLabelClass} ${workSpecificity.labelColorClass}`}
                                        data-testid="segment-work-description-label"
                                    >
                                        {workSpecificity.label}
                                    </span>
                                    <span
                                        className={`${segmentBarClass} ${workSpecificity.barWidthClass} ${workSpecificity.barColorClass}`}
                                        data-testid="segment-work-description-bar"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className={`col-span-7 sm:col-span-8 whitespace-pre-wrap break-words min-h-6 ${boardTextClass} ${boardCellPaddingClass}`}>
                            {workDescriptionText || (
                                isFirstWorkItem ? <span className="text-slate-400">{FIRST_WORK_ITEM_PLACEHOLDERS.workDescription}</span> : ''
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-12 border-t border-slate-800">
                        <div className={`relative col-span-5 sm:col-span-4 bg-slate-50 border-r border-slate-800 font-medium ${boardTextClass} ${boardCellPaddingClass}`}>
                            何が原因で
                            <div className={`absolute text-right ${isCompact ? 'bottom-0.5 right-1' : 'bottom-0.5 right-1.5'}`} data-testid="segment-why-dangerous">
                                <div className={segmentTitleClass}>詳細度</div>
                                <div className="mt-px flex items-center justify-end gap-1">
                                    <span
                                        className={`${segmentLabelClass} ${whyDetail.labelColorClass}`}
                                        data-testid="segment-why-dangerous-label"
                                    >
                                        {whyDetail.label}
                                    </span>
                                    <span
                                        className={`${segmentBarClass} ${whyDetail.barWidthClass} ${whyDetail.barColorClass}`}
                                        data-testid="segment-why-dangerous-bar"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className={`col-span-7 sm:col-span-8 whitespace-pre-wrap break-words min-h-6 ${boardTextClass} ${boardCellPaddingClass}`}>
                            {whyDangerousText || (
                                isFirstWorkItem ? <span className="text-slate-400">{FIRST_WORK_ITEM_PLACEHOLDERS.whyDangerous}</span> : ''
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-12 border-t border-slate-800">
                        <div className={`relative col-span-5 sm:col-span-4 bg-slate-50 border-r border-slate-800 font-medium ${boardTextClass} ${boardCellPaddingClass}`}>
                            どうなる
                            {hasHazardDescription && (
                                <span
                                    className={checkClass}
                                    data-testid="segment-hazard-description-check"
                                    aria-label="どうなる入力済み"
                                >
                                    ✓
                                </span>
                            )}
                        </div>
                        <div className={`col-span-7 sm:col-span-8 whitespace-pre-wrap break-words min-h-6 ${boardTextClass} ${boardCellPaddingClass}`}>
                            {hazardDescriptionText || (
                                isFirstWorkItem ? <span className="text-slate-400">{FIRST_WORK_ITEM_PLACEHOLDERS.hazardDescription}</span> : ''
                            )}
                        </div>
                    </div>

                    {isHazardCompleted && (
                        <>
                            {/* Measures header */}
                            <div className={`grid grid-cols-12 bg-amber-50 font-semibold text-slate-900 border-t-2 border-slate-800 ${boardTextClass}`}>
                                <div className={`col-span-12 ${boardHeaderPaddingClass}`}>
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
                                    <div className={`col-span-5 sm:col-span-4 bg-amber-50 border-r border-slate-800 font-medium ${boardTextClass} ${boardCellPaddingClass}`}>
                                        {CATEGORY_LABELS[row.key]}
                                    </div>
                                    <div className={`col-span-7 sm:col-span-8 bg-amber-50 whitespace-pre-wrap break-words min-h-6 ${boardTextClass} ${boardCellPaddingClass}`}>
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
