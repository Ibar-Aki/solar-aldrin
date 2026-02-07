import type { SoloKYSession } from '@/types/ky';

export const mockPDFSession: SoloKYSession = {
    id: 'mock-session-id',
    userName: 'テスト 太郎',
    siteName: 'テスト現場A',
    weather: '晴れ',
    temperature: 25,
    processPhase: '組み立て',
    healthCondition: 'good',
    workStartTime: new Date('2024-01-01T08:00:00.000Z').toISOString(),
    workEndTime: new Date('2024-01-01T17:00:00.000Z').toISOString(),
    createdAt: new Date('2024-01-01T08:00:00.000Z').toISOString(),
    environmentRisk: '強風のため飛来物に注意が必要です。',
    workItems: [
        {
            id: 'work-1',
            workDescription: '足場の解体作業',
            hazardDescription: '手すりが外れている箇所からの転落',
            riskLevel: 4,
            whyDangerous: [
                '安全帯を使用していない可能性がある',
                '足元が不安定になっている'
            ],
            countermeasures: [
                { category: 'ppe', text: '安全帯を必ず使用する' },
                { category: 'behavior', text: '作業前に足元の安全確認を行う' }
            ]
        },
        {
            id: 'work-2',
            workDescription: '資材の運搬',
            hazardDescription: '重量物による腰痛',
            riskLevel: 2,
            whyDangerous: [
                '中腰での姿勢が続く',
                '一人で無理な重量を持つ'
            ],
            countermeasures: [
                { category: 'behavior', text: '二人以上で運搬する' },
                { category: 'equipment', text: '台車を使用する' }
            ]
        }
    ],
    actionGoal: '安全確認を徹底し、ゼロ災害を目指す',
    pointingConfirmed: true,
    allMeasuresImplemented: true,
    hadNearMiss: true,
    nearMissNote: '強風でヘルメットが飛ばされそうになった',
    completedAt: new Date('2024-01-01T17:30:00.000Z').toISOString()
}

export const mockLongPDFSession: SoloKYSession = {
    id: 'mock-session-long',
    userName: '長文 花子',
    siteName: 'テスト現場B',
    weather: '曇り',
    temperature: 12,
    processPhase: '付帯設備設置・仕上げ',
    healthCondition: 'great',
    workStartTime: new Date('2024-02-01T07:30:00.000Z').toISOString(),
    workEndTime: new Date('2024-02-01T18:10:00.000Z').toISOString(),
    createdAt: new Date('2024-02-01T07:30:00.000Z').toISOString(),
    environmentRisk: '強い風が断続的に発生し、資材の飛散や体勢の崩れが懸念されます。',
    workItems: [
        {
            id: 'work-long-1',
            workDescription: '外壁クラック補修（下地処理、プライマー塗布、シーリング施工を含む）',
            hazardDescription: '高所での長時間作業により集中力が低下し、転落や踏み外しの危険がある。',
            riskLevel: 5,
            whyDangerous: [
                '足場の移動が多く、段差で足を取られやすい',
                '資材が散乱し視界が悪くなる',
                '作業時間が長く疲労が蓄積する',
                '風で体勢が崩れやすい',
                '周囲の作業者との動線が交錯する'
            ],
            countermeasures: [
                { category: 'equipment', text: '作業前に足場の固定を確認する' },
                { category: 'ppe', text: '安全帯の状態を確認する' },
                { category: 'equipment', text: '資材置き場を整理し、通路を確保する' },
                { category: 'behavior', text: '1時間ごとに短い休憩を取る' },
                { category: 'behavior', text: '風が強い時間帯は作業を中断する' },
                { category: 'behavior', text: '互いの動線を共有し声掛けを徹底する' }
            ]
        },
        {
            id: 'work-long-2',
            workDescription: '高圧洗浄による下地洗浄',
            hazardDescription: '足場上でのホース取り回しにより転倒・転落の危険がある。',
            riskLevel: 4,
            whyDangerous: [
                'ホースが足に絡まりやすい',
                '水で足場が滑りやすくなる'
            ],
            countermeasures: [
                { category: 'equipment', text: 'ホースの通り道を固定し、足元を整理する' },
                { category: 'ppe', text: '滑り止め付きの安全靴を使用する' }
            ]
        }
    ],
    actionGoal: '疲労時は無理をせず、声掛けと休憩を徹底する',
    pointingConfirmed: true,
    allMeasuresImplemented: true,
    hadNearMiss: true,
    nearMissNote: 'ホースに足を取られたが、声掛けで転倒を回避。',
    completedAt: new Date('2024-02-01T18:10:00.000Z').toISOString()
}
