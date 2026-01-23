/**
 * メインエントリーポイント - Voice KY Assistant
 */
(function () {
    'use strict';

    /**
     * アプリ初期化
     */
    async function init() {
        console.log('[App] Initializing Voice KY Assistant...');

        try {
            // Service Worker登録
            await registerServiceWorker();

            // IndexedDB初期化
            await Storage.init();

            // オンライン復帰時の同期
            window.addEventListener('online', () => {
                console.log('[App] Online - syncing...');
                Storage.syncPendingRecords();
            });

            console.log('[App] Initialization complete');
        } catch (error) {
            console.error('[App] Initialization error:', error);
            UI.showError('初期化に失敗しました。再読み込みしてください。');
        }

        // エラーがあってもホーム画面を表示
        Router.navigate('home');
    }

    /**
     * Service Worker登録
     */
    async function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('[App] Service Worker registered:', registration.scope);
            } catch (error) {
                console.warn('[App] Service Worker registration failed:', error);
            }
        }
    }

    // DOM Ready後に初期化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
