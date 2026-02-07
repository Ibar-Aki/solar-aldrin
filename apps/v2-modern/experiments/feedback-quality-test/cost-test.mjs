/**
 * KY実費テスト - レート制限対応版
 * 60秒30リクエスト制限を考慮し、3秒間隔でリクエスト
 */

const API_BASE = 'http://localhost:8787';
const DELAY_MS = 3000; // 3秒間隔

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
    console.log('=== KY実費テスト開始 ===');
    console.log('API:', API_BASE);
    console.log('リクエスト間隔:', DELAY_MS / 1000, '秒');
    console.log('開始時刻:', new Date().toLocaleTimeString());
    console.log('');

    let history = [];
    let totalTokens = 0;
    let chatCallCount = 0;
    let successCount = 0;

    // 簡略化したシナリオ（8往復で3作業カバー）
    const userMessages = [
        '今日は足場組立をします。墜落の危険があり、二丁掛けで対策します',
        '危険度は4です。次にグラインダー作業があります',
        '火傷の危険があり、保護メガネで対策します。危険度は3です',
        '次に資材運搬があります',
        '腰痛の危険があり、二人持ちで対策します。危険度は2です',
        'これで全部です。行動目標は二丁掛け徹底です',
        '確認しました',
    ];

    for (const userMsg of userMessages) {
        const messages = [
            ...history,
            { role: 'user', content: userMsg }
        ];

        const payload = {
            messages: messages,
            sessionContext: {
                userName: 'テスト',
                siteName: '現場A',
                weather: '晴れ',
                workItemCount: Math.floor(chatCallCount / 2),
            },
        };

        try {
            const res = await fetch(`${API_BASE}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            chatCallCount++;

            if (res.ok && data.reply) {
                successCount++;
                const tokens = data.usage?.totalTokens || 0;
                totalTokens += tokens;
                console.log(`✓ [${chatCallCount}] ${tokens}tokens "${data.reply.substring(0, 35)}..."`);

                history.push({ role: 'user', content: userMsg });
                history.push({ role: 'assistant', content: data.reply });
            } else {
                console.log(`✗ [${chatCallCount}] ${res.status}: ${data.error || 'error'}`);
            }

        } catch (err) {
            chatCallCount++;
            console.log(`✗ [${chatCallCount}] Network: ${err.message}`);
        }

        await sleep(DELAY_MS);
    }

    // Feedback API
    console.log('\n--- Feedback API ---');
    await sleep(DELAY_MS);

    try {
        const res = await fetch(`${API_BASE}/api/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: 'test-' + Date.now(),
                clientId: 'testclient12345678',
                context: { work: '足場,GR,運搬', location: '現場A', weather: '晴れ' },
                extracted: {
                    risks: ['墜落', '火傷', '腰痛'],
                    measures: ['二丁掛け', '保護メガネ', '二人持ち'],
                    actionGoal: '二丁掛け徹底',
                },
            }),
        });

        const data = await res.json();
        console.log(`[FB] ${res.status}:`, res.ok ? `"${data.praise?.substring(0, 40)}..."` : data.error);
    } catch (err) {
        console.log('[FB] Error:', err.message);
    }

    // 結果
    console.log('\n=====================================');
    console.log('=== 実費テスト結果 ===');
    console.log('=====================================');
    console.log(`成功リクエスト: ${successCount}/${chatCallCount}`);
    console.log(`総トークン数: ${totalTokens}`);

    if (totalTokens > 0) {
        // gpt-4o-mini価格: 入力$0.15/1M, 出力$0.60/1M → 平均$0.375/1M
        const costUsd = totalTokens * 0.375 / 1000000;
        const costJpy = costUsd * 150;

        console.log(`\n【コスト計算 (gpt-4o-mini)】`);
        console.log(`USD: $${costUsd.toFixed(6)}`);
        console.log(`JPY: ¥${costJpy.toFixed(3)}`);
        console.log(`\n>>> 3作業KY 1セッション: 約 ${costJpy.toFixed(2)}円 <<<`);
    } else {
        console.log('\n(トークン情報が取得できませんでした)');
    }

    console.log('\n完了時刻:', new Date().toLocaleTimeString());
}

runTest();
