/**
 * ルーター - 画面遷移管理
 */
const Router = {
    screens: {
        home: HomeScreen,
        chat: ChatScreen,
        confirm: ConfirmScreen,
        done: DoneScreen,
        history: HistoryScreen
    },

    /**
     * 画面遷移
     */
    navigate(screenName) {
        console.log(`[Router] Navigating to: ${screenName}`);

        const screen = this.screens[screenName];
        if (!screen) {
            console.error(`[Router] Unknown screen: ${screenName}`);
            return;
        }

        // 現在の画面をクリア
        const app = document.getElementById('app');
        app.innerHTML = '';

        // 状態更新
        AppState.ui.currentScreen = screenName;

        // 新しい画面をレンダリング
        screen.render(app);

        // 画面固有の初期化
        if (screen.init) {
            screen.init();
        }

        // スクロール位置をリセット
        window.scrollTo(0, 0);
    },

    /**
     * 戻る
     */
    back() {
        const current = AppState.ui.currentScreen;
        const backMap = {
            chat: 'home',
            confirm: 'chat',
            done: 'home',
            history: 'home'
        };

        const target = backMap[current] || 'home';
        this.navigate(target);
    }
};
