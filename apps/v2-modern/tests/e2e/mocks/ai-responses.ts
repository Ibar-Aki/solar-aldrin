export const basicFlowResponses = [
    {
        reply: '危険内容と対策を教えてください。',
        extracted: {
            workDescription: '高所作業',
            hazardDescription: '足場からの転落',
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
            totalTokens: 120,
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
