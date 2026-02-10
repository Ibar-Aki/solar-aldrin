export const basicFlowResponses = [
    {
        reply: '了解です。どんな危険が想定されますか？「何をするとき／何が原因で／どうなる」が分かると助かります。',
        extracted: {
            workDescription: '高所で資材を運ぶとき',
            nextAction: 'ask_hazard',
        },
        usage: {
            totalTokens: 120,
        },
    },
    {
        reply: 'ありがとうございます。危険度は1〜5のどれですか？',
        extracted: {
            whyDangerous: [
                '足元が不安定でバランスを崩しやすい',
            ],
            hazardDescription: '足場から転落する',
            nextAction: 'ask_risk_level',
        },
        usage: {
            totalTokens: 100,
        },
    },
    {
        reply: '対策はOKです。行動目標を短く1つ決めて、画面の「完了」ボタンで終了してください。',
        extracted: {
            countermeasures: [
                { category: 'equipment', text: '足場の点検を実施する' },
                { category: 'ppe', text: '安全帯を二丁掛けで使用する' },
            ],
            actionGoal: '高所作業は足元確認と二丁掛けを徹底する',
            nextAction: 'completed',
        },
        usage: {
            totalTokens: 80,
        },
    },
]
