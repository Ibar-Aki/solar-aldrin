/**
 * Cloudflare Workers - Voice KY Assistant API
 */

// CORS設定
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
};

// ルーティング
export default {
    async fetch(request, env, ctx) {
        // CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: CORS_HEADERS });
        }

        const url = new URL(request.url);
        const path = url.pathname;

        try {
            // ルーティング
            if (path === '/api/chat' && request.method === 'POST') {
                return handleChat(request, env);
            }
            if (path === '/api/advice' && request.method === 'POST') {
                return handleAdvice(request, env);
            }
            if (path === '/api/weather' && request.method === 'GET') {
                return handleWeather(request, env);
            }
            if (path === '/api/records' && request.method === 'POST') {
                return handleSaveRecord(request, env);
            }
            if (path === '/api/records' && request.method === 'GET') {
                return handleGetRecords(request, env);
            }
            if (path === '/api/sync' && request.method === 'POST') {
                return handleSync(request, env);
            }
            if (path === '/api/health') {
                return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
            }

            return jsonResponse({ error: 'Not Found' }, 404);

        } catch (error) {
            console.error('Error:', error);
            return jsonResponse({ error: error.message }, 500);
        }
    }
};

/**
 * JSON レスポンスヘルパー
 */
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: CORS_HEADERS
    });
}

/**
 * AI対話処理
 */
async function handleChat(request, env) {
    const body = await request.json();
    const { sessionId, message, context } = body;

    // システムプロンプト
    const systemPrompt = buildChatSystemPrompt(context);

    // メッセージ履歴を構築
    const messages = [
        { role: 'system', content: systemPrompt },
        ...(context.history || []).map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: message }
    ];

    // OpenAI API呼び出し
    const response = await callOpenAI(messages, env);

    // レスポンスをパース
    try {
        const parsed = JSON.parse(response);
        return jsonResponse(parsed);
    } catch (e) {
        // JSONパース失敗時はテキストをそのまま返す
        return jsonResponse({
            reply: response,
            phase: 'hazard_main',
            done: false,
            data: { hazards: [], countermeasures: [], goal: null }
        });
    }
}

/**
 * 対話用システムプロンプト構築
 */
function buildChatSystemPrompt(context) {
    const weather = context.weather
        ? `${context.weather.condition}、気温${context.weather.temp}℃、風速${context.weather.windSpeed || 0}m/s`
        : '不明';

    const now = new Date();
    const timeOfDay = now.getHours() < 12 ? '午前' : '午後';

    return `あなたは「KY記録くん」という建設現場アシスタントです。
親方（作業員）のKY活動を手伝う新人記録係です。

## 性格・話し方
- 真面目で勉強熱心、でも控えめ
- 「教えてください」「記録させていただきます」という姿勢
- 上から目線は絶対にNG
- 良い回答には「さすがです！」「勉強になります！」

## 対話ルール
- 1回の発話は50文字以内
- 専門用語は平易に（「墜落」→「落ちる」）
- 否定形を使わない
- 相槌を入れる（「なるほど」「いいですね」）

## 対話の流れ
Phase 1: greeting → 挨拶、天候に触れる
Phase 2: hazard_main → 「どんな危険がありそうですか？」
Phase 3: hazard_detail → 抽象的なら「具体的に教えてください」
Phase 4: hazard_more → 「他にありますか？」→なければ次へ
Phase 5: counter → 「{{危険}}への対策は？」
Phase 6: goal → 「今日の合言葉を決めてください」
Phase 7: done → 「ありがとうございます！ご安全に！」

## 今日の情報
作業: 足場設置
天候: ${weather}
時刻: ${timeOfDay}

## 出力形式（JSON）
必ず以下のJSON形式で返してください：
{
  "reply": "発話内容",
  "phase": "現在のフェーズID",
  "done": false,
  "data": {
    "hazards": ["抽出した危険（あれば）"],
    "countermeasures": ["抽出した対策（あれば）"],
    "goal": "合言葉（あれば）"
  }
}`;
}

/**
 * アドバイス生成処理
 */
async function handleAdvice(request, env) {
    const body = await request.json();
    const { workType, weather, hazards, countermeasures, actionGoal } = body;

    const prompt = `KYアドバイザーとして、以下のKY内容を評価し、改善ヒントを1-2個提供してください。

## 評価対象
- 作業: ${workType}
- 天候: ${weather ? `${weather.condition} ${weather.temp}℃` : '不明'}
- 危険: ${hazards?.join(', ') || 'なし'}
- 対策: ${countermeasures?.join(', ') || 'なし'}
- 合言葉: ${actionGoal || 'なし'}

## 評価観点
1. 具体性（「落ちる」<「布板設置時に足を滑らせて落ちる」）
2. 網羅性（墜落だけでなく落下物も）
3. 対策の実行可能性（「気をつける」は曖昧）
4. 天候の考慮

## 出力（JSON配列のみ、他のテキストなし）
[{"type": "tip"|"good", "text": "30文字以内のアドバイス"}]`;

    const messages = [
        { role: 'system', content: 'あなたはKYアドバイザーです。指定された形式のJSONのみを出力してください。' },
        { role: 'user', content: prompt }
    ];

    const response = await callOpenAI(messages, env);

    try {
        const advices = JSON.parse(response);
        return jsonResponse({ advices });
    } catch (e) {
        return jsonResponse({ advices: [{ type: 'good', text: 'KY実施お疲れ様でした！' }] });
    }
}

/**
 * 天候情報取得
 */
async function handleWeather(request, env) {
    const url = new URL(request.url);
    const lat = url.searchParams.get('lat');
    const lon = url.searchParams.get('lon');

    if (!lat || !lon) {
        return jsonResponse({ error: 'lat and lon required' }, 400);
    }

    const apiKey = env.WEATHER_API_KEY;
    if (!apiKey) {
        // APIキーがない場合はダミーデータ
        return jsonResponse({
            condition: '晴れ',
            temp: 15,
            windSpeed: 3,
            humidity: 50
        });
    }

    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=ja`;

    const response = await fetch(weatherUrl);
    const data = await response.json();

    // 天候を日本語に変換
    const conditionMap = {
        'Clear': '晴れ',
        'Clouds': '曇り',
        'Rain': '雨',
        'Snow': '雪',
        'Drizzle': '小雨',
        'Thunderstorm': '雷雨',
        'Mist': '霧',
        'Fog': '霧'
    };

    return jsonResponse({
        condition: conditionMap[data.weather?.[0]?.main] || data.weather?.[0]?.description || '不明',
        temp: Math.round(data.main?.temp || 0),
        windSpeed: Math.round(data.wind?.speed || 0),
        humidity: data.main?.humidity || 0
    });
}

/**
 * 記録保存
 */
async function handleSaveRecord(request, env) {
    const body = await request.json();

    // Supabaseに保存（実装時に追加）
    // ここでは成功レスポンスを返す
    console.log('Saving record:', body.id);

    return jsonResponse({ success: true, id: body.id });
}

/**
 * 記録一覧取得
 */
async function handleGetRecords(request, env) {
    // Supabaseから取得（実装時に追加）
    return jsonResponse({ records: [] });
}

/**
 * 同期処理
 */
async function handleSync(request, env) {
    const body = await request.json();
    const { records } = body;

    // 各レコードを保存
    const results = [];
    for (const record of records || []) {
        results.push({ id: record.id, status: 'ok' });
    }

    return jsonResponse({ results });
}

/**
 * OpenAI API呼び出し
 */
async function callOpenAI(messages, env) {
    const apiKey = env.OPENAI_API_KEY;

    if (!apiKey) {
        throw new Error('OPENAI_API_KEY not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages,
            temperature: 0.7,
            max_tokens: 500
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}
