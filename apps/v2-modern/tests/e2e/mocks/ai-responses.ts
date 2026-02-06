export const basicFlowResponses = [
    {
        reply: '想定される危険は分かりました。どのような状況で危険になりますか？',
        extracted: {
            workDescription: '高所作業',
            hazardDescription: '足場からの転落',
            nextAction: 'ask_why',
        },
        usage: {
            totalTokens: 120,
        },
    },
    {
        reply: 'ありがとうございます。危険度は1〜5のどれですか？',
        extracted: {
            whyDangerous: [
                '安全帯が外れる可能性がある',
                '足元が不安定になりやすい',
            ],
            countermeasures: [
                '安全帯を二丁掛けする',
                '作業前に足場の点検を行う',
            ],
            nextAction: 'ask_risk_level',
        },
        usage: {
            totalTokens: 100,
        },
    },
    {
        reply: '他に作業があれば教えてください。',
        extracted: {
            riskLevel: 3,
            nextAction: 'ask_more_work',
        },
        usage: {
            totalTokens: 80,
        },
    },
]
