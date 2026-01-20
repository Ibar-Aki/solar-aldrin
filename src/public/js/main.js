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

        // Service Worker登録
        await registerServiceWorker();

        // IndexedDB初期化
        await Storage.init();

        // オンライン復帰時の同期
        window.addEventListener('online', () => {
            console.log('[App] Online - syncing...');
            Storage.syncPendingRecords();
        });

        // ホーム画面を表示
        Router.navigate('home');

        console.log('[App] Initialization complete');
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
