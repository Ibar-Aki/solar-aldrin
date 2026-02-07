import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { CountermeasureCategory, WorkItem } from '@/types/ky'

const CATEGORY_ORDER: CountermeasureCategory[] = ['ppe', 'behavior', 'equipment']
const CATEGORY_LABELS: Record<CountermeasureCategory, string> = {
    ppe: '保護具',
    behavior: '行動',
    equipment: '設備・準備',
}

const SUGGESTIONS: Record<CountermeasureCategory, string[]> = {
    ppe: [
        'ヘルメット・安全帯など保護具を正しく使用する',
        '手袋/保護メガネなど必要な保護具を着用する',
    ],
    behavior: [
        '指差し呼称で要所を確認する',
        '声掛け・合図を徹底する',
    ],
    equipment: [
        '作業前に足場/工具/設備の点検を行う',
        '立入禁止の区画や養生を実施する',
    ],
}

function getPresentCategories(countermeasures: WorkItem['countermeasures'] | undefined): Set<CountermeasureCategory> {
    const set = new Set<CountermeasureCategory>()
    if (!countermeasures) return set
    for (const cm of countermeasures) set.add(cm.category)
    return set
}

export function ConfirmedInfoCard(props: {
    currentWorkItem: Partial<WorkItem>
    disabled?: boolean
    onChangeCountermeasureCategory: (index: number, category: CountermeasureCategory) => void
    onSendSuggestion: (text: string) => void
}) {
    const { currentWorkItem, disabled, onChangeCountermeasureCategory, onSendSuggestion } = props

    const measures = currentWorkItem.countermeasures ?? []
    const present = getPresentCategories(measures)
    const missing = CATEGORY_ORDER.filter((c) => !present.has(c))
    const progressText = CATEGORY_ORDER
        .map((c) => `${CATEGORY_LABELS[c]} ${present.has(c) ? '✓' : '—'}`)
        .join(' / ')

    const hasAny =
        Boolean(currentWorkItem.workDescription) ||
        Boolean(currentWorkItem.hazardDescription) ||
        Boolean(currentWorkItem.whyDangerous?.length) ||
        measures.length > 0

    return (
        <Card className="border-slate-200 bg-white/90">
            <CardHeader className="py-3">
                <CardTitle className="text-base text-slate-900">確認済み情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* 入力内容を常に可視化（未入力は空欄） */}
                <div className="rounded border border-slate-200 overflow-hidden">
                    <div className="grid grid-cols-2 bg-slate-50 text-xs text-slate-600">
                        <div className="px-3 py-2 border-r border-slate-200">何の作業時に</div>
                        <div className="px-3 py-2">何をするときに</div>
                    </div>
                    <div className="grid grid-cols-2 text-sm text-slate-900">
                        <div className="px-3 py-2 border-r border-slate-200 min-h-6 whitespace-pre-wrap break-words">
                            {currentWorkItem.workDescription ?? ''}
                        </div>
                        <div className="px-3 py-2 min-h-6 whitespace-pre-wrap break-words">
                            {currentWorkItem.hazardDescription ?? ''}
                        </div>
                    </div>
                </div>

                {hasAny && (
                    <div className="text-xs text-slate-600">
                        <div className="font-medium text-slate-700">対策カテゴリ進捗</div>
                        <div>{progressText}</div>
                        <div className="mt-1 text-slate-500">
                            この作業は対策が2カテゴリ以上そろうと保存されます。
                        </div>
                    </div>
                )}

                {currentWorkItem.whyDangerous && currentWorkItem.whyDangerous.length > 0 && (
                    <div className="text-sm">
                        <div className="text-slate-500 mb-1">要因</div>
                        <ul className="list-disc pl-5 space-y-0.5 text-slate-900">
                            {currentWorkItem.whyDangerous.slice(0, 5).map((w, i) => (
                                <li key={i}>{w}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {measures.length > 0 && (
                    <div className="text-sm">
                        <div className="text-slate-500 mb-1">対策（カテゴリは編集できます）</div>
                        <div className="space-y-2">
                            {measures.map((cm, idx) => (
                                <div key={`${cm.text}-${idx}`} className="flex items-start gap-2">
                                    <select
                                        className="mt-0.5 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800"
                                        value={cm.category}
                                        onChange={(e) => onChangeCountermeasureCategory(idx, e.target.value as CountermeasureCategory)}
                                        disabled={disabled}
                                        aria-label={`対策カテゴリ ${idx + 1}`}
                                    >
                                        {CATEGORY_ORDER.map((c) => (
                                            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                                        ))}
                                    </select>
                                    <div className="flex-1 text-slate-900">{cm.text}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {hasAny && missing.length > 0 && (
                    <div className="text-sm">
                        <div className="text-slate-500 mb-2">
                            不足カテゴリ: {missing.map((c) => CATEGORY_LABELS[c]).join(' / ')}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {missing.flatMap((c) => (
                                SUGGESTIONS[c].map((text) => (
                                    <Button
                                        key={`${c}:${text}`}
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-auto py-2 whitespace-normal text-left text-xs border-slate-200"
                                        onClick={() => onSendSuggestion(text)}
                                        disabled={disabled}
                                    >
                                        {CATEGORY_LABELS[c]}: {text}
                                    </Button>
                                ))
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
