import type { HealthCondition, ProcessPhase } from '@/types/ky'

/** 工程選択肢 (UX-11) */
export const PROCESS_PHASES: ProcessPhase[] = [
    'フリー',
    '搬入・荷受け',
    '基礎土台・建地準備',
    '組み立て',
    '付帯設備設置・仕上げ',
    '引き渡し前確認',
]

/** 天候選択肢 */
export const WEATHER_OPTIONS = [
    '晴れ',
    '曇り',
    '雨',
    '雪',
    '強風',
    '猛暑',
    '厳寒',
] as const

/** 体調ラベル */
export const HEALTH_CONDITION_LABELS: Record<HealthCondition, string> = {
    bad: '悪い',
    good: 'よい',
    great: 'すごくよい',
}

/** 体調選択肢 (UX-12) */
export const HEALTH_CONDITIONS: { value: HealthCondition; label: string }[] = [
    { value: 'bad', label: HEALTH_CONDITION_LABELS.bad },
    { value: 'good', label: HEALTH_CONDITION_LABELS.good },
    { value: 'great', label: HEALTH_CONDITION_LABELS.great },
]
