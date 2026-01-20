/**
 * ホーム画面
 */
const HomeScreen = {
    render(container) {
        container.innerHTML = `
      <div class="screen home">
        <div class="home-logo">🏗️</div>
        <h1 class="home-title">Voice KY Assistant</h1>
        <p class="home-subtitle">話すだけでKYが完了</p>
        
        <button class="home-start-btn" id="startBtn">
          <span class="icon">🎙️</span>
          <span>KY開始</span>
        </button>
        
        <a href="#" class="home-history-link" id="historyLink">📋 履歴を見る</a>
      </div>
    `;
    },

    init() {
        // KY開始ボタン
        document.getElementById('startBtn').addEventListener('click', async () => {
            // セッションをリセット
            resetSession();

            // 天候取得を試みる
            await this.fetchWeather();

            // 対話画面へ
            Router.navigate('chat');
        });

        // 履歴リンク
        document.getElementById('historyLink').addEventListener('click', (e) => {
            e.preventDefault();
            Router.navigate('history');
        });
    },

    /**
     * 天候情報を取得
     */
    async fetchWeather() {
        try {
            // 位置情報取得
            const position = await this.getPosition();
            const { latitude, longitude } = position.coords;

            // 天候API呼び出し
            const weather = await API.getWeather(latitude, longitude);
            AppState.session.weather = weather;
            console.log('[Home] Weather:', weather);
        } catch (error) {
            console.warn('[Home] Failed to get weather:', error);
            // 天候なしでも続行
            AppState.session.weather = null;
        }
    },

    /**
     * 位置情報を取得
     */
    getPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: false,
                timeout: 5000,
                maximumAge: 300000 // 5分キャッシュ
            });
        });
    }
};
