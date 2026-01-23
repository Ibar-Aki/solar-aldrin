/**
 * 状態管理 - Voice KY Assistant
 */
const AppState = {
    // 現在のセッション
    session: {
        id: null,
        workType: null,
        siteName: '',
        weather: null,
        startTime: null
    },

    // 対話データ
    conversation: {
        messages: [],      // [{role, content, timestamp}]
        phase: 'greeting', // 現在のフェーズ
        extractedData: {
            hazards: [],
            countermeasures: [],
            actionGoal: null
        }
    },

    // アドバイス
    advice: [],

    // UI状態
    ui: {
        currentScreen: 'home',
        isListening: false,
        isProcessing: false,
        error: null
    }
};

/**
 * 状態のリセット（新規KY開始時）
 */
function resetSession() {
    AppState.session = {
        id: generateUUID(),
        workType: 'scaffold',
        siteName: '',
        weather: null,
        startTime: new Date().toISOString()
    };
    AppState.conversation = {
        messages: [],
        phase: 'greeting',
        extractedData: {
            hazards: [],
            countermeasures: [],
            actionGoal: null
        }
    };
    AppState.advice = [];
    AppState.ui.error = null;
}

/**
 * メッセージを追加
 */
function addMessage(role, content) {
    AppState.conversation.messages.push({
        role,
        content,
        timestamp: new Date().toISOString()
    });
}

/**
 * UUID生成
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * 対話完了判定
 */
function isConversationComplete() {
    return AppState.conversation.phase === 'done';
}
