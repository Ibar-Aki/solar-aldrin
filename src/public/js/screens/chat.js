/**
 * 対話画面
 */
const ChatScreen = {
    interimText: '',

    render(container) {
        const weather = AppState.session.weather;
        const weatherInfo = weather
            ? `${UI.getWeatherIcon(weather.condition)} ${UI.escapeHtml(weather.condition)} ${UI.escapeHtml(String(weather.temp))}℃`
            : '';

        container.innerHTML = `
      ${UI.createHeader('🏗️ 足場設置 KY')}
      
      <div class="screen chat">
        <div class="chat-messages" id="chatMessages">
          <!-- メッセージがここに追加される -->
        </div>
        
        <div class="chat-input-area">
          ${weatherInfo ? `<div class="text-muted text-center mb-sm">${weatherInfo}</div>` : ''}
          
          <div class="chat-input-row">
            <input type="text" 
                   class="chat-text-input" 
                   id="textInput" 
                   placeholder="ここに入力..."
                   autocomplete="off">
            <button class="btn btn-icon send-btn" id="sendBtn">➤</button>
          </div>
          
          <div class="text-center" style="margin-top:16px;">
            <button class="mic-btn" id="micBtn">🎙️</button>
            <div id="interimText" class="text-muted" style="margin-top:8px;min-height:20px;"></div>
          </div>
        </div>
      </div>
    `;
    },

    init() {
        this.messagesEl = document.getElementById('chatMessages');
        this.textInput = document.getElementById('textInput');
        this.micBtn = document.getElementById('micBtn');
        this.sendBtn = document.getElementById('sendBtn');
        this.interimEl = document.getElementById('interimText');

        // 音声認識セットアップ
        this.setupSpeech();

        // イベントリスナー
        this.micBtn.addEventListener('click', () => this.toggleMic());
        this.sendBtn.addEventListener('click', () => this.sendTextInput());
        this.textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendTextInput();
            }
        });

        // 既存の会話履歴があれば復元（修正から戻ってきた場合）
        const existingMessages = AppState.conversation.messages;
        if (existingMessages && existingMessages.length > 0) {
            existingMessages.forEach(m => {
                this.addMessageToUI(m.role, m.content);
            });
        } else {
            // 初回メッセージを送信してAIの挨拶を取得
            this.startConversation();
        }
    },

    /**
     * 音声認識セットアップ
     */
    setupSpeech() {
        Speech.init();

        Speech.onInterim = (text) => {
            this.interimEl.textContent = text;
        };

        Speech.onResult = (text) => {
            this.interimEl.textContent = '';
            this.sendMessage(text);
        };

        Speech.onError = (message) => {
            UI.showError(message);
            this.micBtn.classList.remove('listening');
        };

        Speech.onEnd = () => {
            this.micBtn.classList.remove('listening');
        };
    },

    /**
     * マイクトグル
     */
    toggleMic() {
        if (Speech.isListening) {
            Speech.stopListening();
            this.micBtn.classList.remove('listening');
        } else {
            if (Speech.startListening()) {
                this.micBtn.classList.add('listening');
            }
        }
    },

    /**
     * テキスト入力送信
     */
    sendTextInput() {
        const text = this.textInput.value.trim();
        if (text) {
            this.textInput.value = '';
            this.sendMessage(text);
        }
    },

    /**
     * 会話開始
     */
    async startConversation() {
        AppState.ui.isProcessing = true;

        try {
            // AIの初回メッセージを取得
            const response = await API.chat('（会話開始）');
            this.handleAIResponse(response);
        } catch (error) {
            console.error('[Chat] Failed to start:', error);
            // オフライン時のフォールバック
            const fallbackMessage = AppState.session.weather
                ? `今日は${AppState.session.weather.condition}ですね。足場設置作業で、どんな危険がありそうですか？`
                : '足場設置作業で、どんな危険がありそうですか？';
            this.addMessageToUI('assistant', fallbackMessage);
            addMessage('assistant', fallbackMessage); // ログにも保存
        } finally {
            AppState.ui.isProcessing = false;
        }
    },

    /**
     * メッセージ送信
     */
    async sendMessage(text) {
        // ユーザーメッセージを表示
        this.addMessageToUI('user', text);
        addMessage('user', text);

        // 処理中
        AppState.ui.isProcessing = true;

        try {
            const response = await API.chat(text);
            this.handleAIResponse(response);
        } catch (error) {
            console.error('[Chat] API error:', error);
            UI.showError('通信エラーが発生しました');

            // オフライン時は簡易応答
            this.addMessageToUI('assistant', 'すみません、通信できませんでした。もう一度お試しください。');
        } finally {
            AppState.ui.isProcessing = false;
        }
    },

    /**
     * AIレスポンス処理
     */
    handleAIResponse(response) {
        // メッセージ表示
        this.addMessageToUI('assistant', response.reply);
        addMessage('assistant', response.reply);

        // 音声読み上げ
        Speech.speak(response.reply);

        // フェーズ更新
        AppState.conversation.phase = response.phase;

        // 抽出データ更新
        if (response.data) {
            const extracted = AppState.conversation.extractedData;
            if (response.data.hazards?.length) {
                extracted.hazards = response.data.hazards;
            }
            if (response.data.countermeasures?.length) {
                extracted.countermeasures = response.data.countermeasures;
            }
            if (response.data.goal) {
                extracted.actionGoal = response.data.goal;
            }
        }

        // 完了チェック
        if (response.done) {
            this.onConversationComplete();
        }
    },

    /**
     * メッセージをUIに追加
     */
    addMessageToUI(role, content) {
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${role}`;
        const escapedContent = UI.escapeHtml(content);
        messageEl.innerHTML = `
      <div class="message-role">${role === 'assistant' ? '🤖 KY記録くん' : '👤 あなた'}</div>
      <div class="message-content">${escapedContent}</div>
    `;
        this.messagesEl.appendChild(messageEl);

        // スクロール
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    },

    /**
     * 会話完了時
     */
    async onConversationComplete() {
        console.log('[Chat] Conversation complete');

        // 少し待ってから確認画面へ
        setTimeout(async () => {
            // アドバイス取得
            try {
                const adviceResponse = await API.getAdvice();
                AppState.advice = adviceResponse.advices || [];
            } catch (error) {
                console.warn('[Chat] Failed to get advice:', error);
                AppState.advice = [];
            }

            Router.navigate('confirm');
        }, 1500);
    }
};
