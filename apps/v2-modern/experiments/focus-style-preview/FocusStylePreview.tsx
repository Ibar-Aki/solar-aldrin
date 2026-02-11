import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type FocusPattern = {
    id: string
    title: string
    description: string
    inputClassName: string
    textareaClassName: string
}

const PATTERNS: FocusPattern[] = [
    {
        id: 'teams-bottom-line',
        title: 'A. Blue Bottom Line (Teams系)',
        description: 'フォーカス時に下線だけ青を強調。枠は落ち着いたまま。',
        inputClassName: 'focus-visible:ring-0 focus-visible:shadow-none focus-visible:rounded-b-none focus-visible:border-b-2 focus-visible:border-b-blue-600',
        textareaClassName: 'focus-visible:ring-0 focus-visible:shadow-none focus-visible:rounded-b-none focus-visible:border-b-2 focus-visible:border-b-blue-600',
    },
    {
        id: 'soft-blue-fill',
        title: 'B. Soft Blue Fill',
        description: 'フォーカス時に淡い青背景で入力状態を柔らかく可視化。',
        inputClassName: 'focus-visible:ring-0 focus-visible:shadow-none focus-visible:border-blue-500 focus-visible:bg-blue-50/70',
        textareaClassName: 'focus-visible:ring-0 focus-visible:shadow-none focus-visible:border-blue-500 focus-visible:bg-blue-50/70',
    },
    {
        id: 'brand-border-only',
        title: 'C. Brand Border Only',
        description: '影を使わず、枠線色だけブランドブルーで明確化。',
        inputClassName: 'focus-visible:ring-0 focus-visible:shadow-none focus-visible:border-blue-600',
        textareaClassName: 'focus-visible:ring-0 focus-visible:shadow-none focus-visible:border-blue-600',
    },
    {
        id: 'dual-accent',
        title: 'D. Dual Accent',
        description: 'フォーカス時に左アクセントラインと青枠を同時に表示。',
        inputClassName: 'focus-visible:ring-0 focus-visible:shadow-none focus-visible:border-blue-600 focus-visible:border-l-4',
        textareaClassName: 'focus-visible:ring-0 focus-visible:shadow-none focus-visible:border-blue-600 focus-visible:border-l-4',
    },
]

export function FocusStylePreview() {
    return (
        <Card className="py-3" data-testid="focus-style-preview">
            <CardHeader className="pb-2">
                <CardTitle className="text-base">入力フォーカスUI 比較モデル（候補4パターン）</CardTitle>
                <p className="text-xs text-slate-600">
                    見た目比較専用です。ここで選んだ候補を、本番の入力欄に横展開します。
                </p>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {PATTERNS.map((pattern) => (
                        <div
                            key={pattern.id}
                            className="rounded-lg border border-slate-200 bg-white p-3"
                            data-testid={`focus-pattern-${pattern.id}`}
                        >
                            <h3 className="text-sm font-semibold text-slate-900">{pattern.title}</h3>
                            <p className="mt-1 text-xs text-slate-600">{pattern.description}</p>

                            <div className="mt-3 space-y-2">
                                <Input
                                    placeholder="作業者名の入力イメージ"
                                    className={pattern.inputClassName}
                                    data-testid={`focus-pattern-input-${pattern.id}`}
                                />
                                <Textarea
                                    placeholder="チャット入力のイメージ"
                                    className={pattern.textareaClassName}
                                    rows={2}
                                    data-testid={`focus-pattern-textarea-${pattern.id}`}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
