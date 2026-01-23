/**
 * API通信モジュール
 */
const API = {
    // 簡易認証キー（サーバー側の API_SECRET_KEY と一致させる）
    API_KEY: 'solar-aldrin-secret-key-2026',

    // ベースURL（開発時はローカル、本番時はWorkers）
    // ベースURL（開発時はローカル/IP、本番時はWorkers）
    baseUrl: (window.location.hostname === 'localhost' || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(window.location.hostname))
        ? `http://${window.location.hostname}:8787`
        : 'https://voice-ky-api.solar-aldrin-ky.workers.dev',

    /**
     * 汎用リクエスト
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                'X-Custom-Auth': this.API_KEY,
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`[API] Error:`, error);
            throw error;
        }
    },

    /**
     * AI対話
     */
    async chat(message) {
        return this.request('/api/chat', {
            method: 'POST',
            body: JSON.stringify({
                sessionId: AppState.session.id,
                message,
                context: {
                    workType: AppState.session.workType,
                    weather: AppState.session.weather,
                    history: AppState.conversation.messages.slice(-10) // 直近10件
                }
            })
        });
    },

    /**
     * アドバイス取得
     */
    async getAdvice() {
        const data = AppState.conversation.extractedData;
        return this.request('/api/advice', {
            method: 'POST',
            body: JSON.stringify({
                workType: AppState.session.workType,
                weather: AppState.session.weather,
                hazards: data.hazards,
                countermeasures: data.countermeasures,
                actionGoal: data.actionGoal
            })
        });
    },

    /**
     * 天候情報取得
     */
    async getWeather(lat, lon) {
        return this.request(`/api/weather?lat=${lat}&lon=${lon}`);
    },

    /**
     * 記録保存
     */
    async saveRecord(record) {
        return this.request('/api/records', {
            method: 'POST',
            body: JSON.stringify(record)
        });
    },

    /**
     * 記録一覧取得
     */
    async getRecords() {
        return this.request('/api/records');
    },

    /**
     * 同期
     */
    async sync(records) {
        return this.request('/api/sync', {
            method: 'POST',
            body: JSON.stringify({ records })
        });
    }
};
