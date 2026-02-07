/**
 * KY実費テスト & コスト比較シミュレーター
 * API呼び出しを試行し、失敗した場合はローカル試算（トークン推定）を行います。
 */

const API_BASE = 'http://localhost:8787';
const DELAY_MS = 2000;

// === モデル単価設定 (USD / 1M tokens) ===
// 2026-02時点の価格
const PRICING = {
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-5-mini': { input: 0.25, output: 2.00 }, // 推定: 4o-miniの約1.5-3倍
    'gpt-5.2': { input: 1.75, output: 14.00 } // 推定: 高機能モデル
};

const RATE = 150; // 1ドル = 150円

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 簡易トークン数見積もり (日本語: 文字数 * 1.0〜1.2, 英語: 単語数 * 1.3 程度)
// 今回は安全側に倒して 文字数 * 1.1 とします
function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length * 1.1);
}

// KYシステムプロンプトの概算サイズ (soloKY.ts + feedbackKY.ts)
const SYSTEM_PROMPT_TOKENS = {
    chat: 2600,
    feedback: 800
};

async function runTest() {
    console.log('=== KYコスト試算テスト ===');
    console.log(`レート: 1USD = ${RATE}円`);
    console.log('--------------------------------------------------');

    // テストデータ
    const userMessages = [
        '今日は足場組立作業です。危険は墜落です', // 作業1
        '対策は二丁掛けです。危険度は4です',
        '次にグラインダー作業です。危険は火花による火傷です', // 作業2
        '対策は保護メガネです。危険度は3です',
        '次に資材運搬です。危険は腰痛です', // 作業3
        '対策は二人作業です。危険度は2です',
        '以上です。行動目標は二丁掛けヨシ！です',
        '確認しました'
    ];

    let history = [];
    let usage = {
        chat: { input: 0, output: 0, count: 0 },
        feedback: { input: 0, output: 0 }
    };
    let isApiWorking = true;

    // --- 1. Chat API Test ---
    console.log('Running Chat API Test...');

    for (const userMsg of userMessages) {
        const messages = [...history, { role: 'user', content: userMsg }];
        const payload = {
            messages: messages,
            sessionContext: { workItemCount: 1 }
        };

        let reply = "";
        let inputTokens = 0;
        let outputTokens = 0;

        if (isApiWorking) {
            try {
                // API呼び出し
                const res = await fetch(`${API_BASE}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    const data = await res.json();
                    reply = data.reply || "（応答なし）";
                    // usageが返ってくれば使う
                    if (data.usage?.totalTokens) {
                        // 入出力の内訳が不明な場合が多いが、簡易的に配分推定
                        // system + history + msg
                        outputTokens = estimateTokens(reply);
                        inputTokens = data.usage.totalTokens - outputTokens;
                    } else {
                        // usageがない場合は推定
                        outputTokens = estimateTokens(reply);
                        const historyText = messages.map(m => m.content).join("");
                        inputTokens = SYSTEM_PROMPT_TOKENS.chat + estimateTokens(historyText);
                    }
                    console.log(`✓ Chat [OK] API usage: ${inputTokens + outputTokens} tokens`);

                } else {
                    console.log(`! Chat [Error ${res.status}] Switching to local estimation...`);
                    isApiWorking = false;
                }
            } catch (e) {
                console.log(`! Chat [Network Error] Switching to local estimation...`);
                isApiWorking = false;
            }
        }

        if (!isApiWorking) {
            // ローカル推定モード
            reply = "（モック応答：はい、承知しました。次の作業はありますか？）";
            const historyText = messages.map(m => m.content).join("");
            inputTokens = SYSTEM_PROMPT_TOKENS.chat + estimateTokens(historyText);
            outputTokens = estimateTokens(reply);
            console.log(`- Chat [Est] estimated: ${inputTokens + outputTokens} tokens`);
        }

        usage.chat.input += inputTokens;
        usage.chat.output += outputTokens;
        usage.chat.count++;

        // 履歴更新
        history.push({ role: 'user', content: userMsg });
        history.push({ role: 'assistant', content: reply });

        if (isApiWorking) await sleep(DELAY_MS);
    }

    // --- 2. Feedback API Test ---
    console.log('\nRunning Feedback API Test...');
    let fbInput = 0;
    let fbOutput = 0;

    const fbPayload = {
        sessionId: 'test', clientId: 'test',
        extracted: { risks: ['墜落', '火傷', '腰痛'], measures: ['二丁掛け', '保護メガネ', '二人作業'] },
        chatDigest: '足場組立、グラインダー、運搬作業のKYを実施'
    };

    if (isApiWorking) {
        try {
            const res = await fetch(`${API_BASE}/api/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fbPayload)
            });
            if (res.ok) {
                const data = await res.json();
                const replyText = JSON.stringify(data);
                fbOutput = estimateTokens(replyText);
                // 入力は context + extracted + digest + prompt
                fbInput = SYSTEM_PROMPT_TOKENS.feedback + estimateTokens(JSON.stringify(fbPayload));
                console.log(`✓ Feedback [OK] Estimated tokens: ${fbInput + fbOutput}`);
            } else {
                console.log(`! Feedback [Error ${res.status}] Using estimation.`);
                isApiWorking = false;
            }
        } catch (e) {
            isApiWorking = false;
        }
    }

    if (!isApiWorking) {
        fbOutput = 400; // 想定出力サイズ
        fbInput = SYSTEM_PROMPT_TOKENS.feedback + 600; // 想定入力サイズ
        console.log(`- Feedback [Est] Using estimation.`);
    }

    usage.feedback.input = fbInput;
    usage.feedback.output = fbOutput;


    // --- 3. コスト計算 & 比較 ---
    console.log('\n==================================================');
    console.log('=== 結果：1 KYセッション (3作業分) のコスト試算 ===');
    console.log('==================================================');

    // APIステータス表示
    console.log(`[APIステータス]`);
    if (isApiWorking) {
        console.log(`✅ 正常 (APIからのUsage情報を使用)`);
    } else {
        console.log(`❌ エラー発生 (ローカル推定モードで試算)`);
        console.log(`   ※APIキーが無効、またはネットワークエラーの可能性があります。`);
    }
    console.log('--------------------------------------------------');

    console.log(`[トークン使用量]`);
    console.log(`Chat (${usage.chat.count}回): 入力 ${usage.chat.input.toLocaleString()} / 出力 ${usage.chat.output.toLocaleString()}`);
    console.log(`Feedback (1回): 入力 ${usage.feedback.input.toLocaleString()} / 出力 ${usage.feedback.output.toLocaleString()}`);

    const totalInput = usage.chat.input + usage.feedback.input;
    const totalOutput = usage.chat.output + usage.feedback.output;
    console.log(`合計: 入力 ${totalInput.toLocaleString()} / 出力 ${totalOutput.toLocaleString()}`);
    console.log('--------------------------------------------------');

    // コスト計算関数
    const calc = (modelKey) => {
        const price = PRICING[modelKey];
        const costInput = (totalInput / 1_000_000) * price.input;
        const costOutput = (totalOutput / 1_000_000) * price.output;
        const totalUsd = costInput + costOutput;
        const totalJpy = totalUsd * RATE;
        return { totalUsd, totalJpy };
    };

    // Chatは常に data-4o-mini (現状)
    // Feedbackだけモデルを変える場合を試算したいが、
    // ここでは要望通り「KYフィードバックのモデル変更に伴う1回あたり費用」と
    // 「全体の費用」を出す

    const baseCost = calc('gpt-4o-mini');

    console.log(`【現状構成】 (All gpt-4o-mini)`);
    console.log(`  USD: $${baseCost.totalUsd.toFixed(5)}`);
    console.log(`  JPY: ${baseCost.totalJpy.toFixed(2)} 円`);

    console.log(`\n【フィードバック機能のみモデルを変更した場合の追加コスト】`);
    console.log(`  (Feedback入力: ${usage.feedback.input.toLocaleString()} / 出力: ${usage.feedback.output.toLocaleString()})`);

    const compareModels = ['gpt-4o-mini', 'gpt-5-mini', 'gpt-5.2'];

    console.log('\n| モデル | Feedback単体コスト(円) | 1セッション総額(円) | 現状比 |');
    console.log('|---|---|---|---|');

    compareModels.forEach(model => {
        const p = PRICING[model];
        // Feedback部分のコスト
        const fbCostUsd = ((usage.feedback.input / 1e6) * p.input) + ((usage.feedback.output / 1e6) * p.output);
        const fbCostJpy = fbCostUsd * RATE;

        // Chat部分(4o-mini固定)
        const chatCostUsd = ((usage.chat.input / 1e6) * PRICING['gpt-4o-mini'].input) + ((usage.chat.output / 1e6) * PRICING['gpt-4o-mini'].output);

        const totalSessionJpy = (chatCostUsd + fbCostUsd) * RATE;
        const ratio = totalSessionJpy / baseCost.totalJpy;

        console.log(`| ${model.padEnd(11)} | ${fbCostJpy.toFixed(2)} 円 | ${totalSessionJpy.toFixed(2)} 円 | ${ratio.toFixed(1)}倍 |`);
    });
    console.log('--------------------------------------------------');
}

runTest();
