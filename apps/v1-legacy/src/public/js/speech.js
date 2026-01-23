/**
 * 音声認識・合成モジュール
 */
const Speech = {
    recognition: null,
    synthesis: window.speechSynthesis,
    isListening: false,

    // コールバック
    onResult: null,
    onInterim: null,
    onError: null,
    onEnd: null,

    // 内部フラグ
    isManualStop: false,

    /**
     * HTTPS接続かどうか判定
     */
    isSecureContext() {
        return window.isSecureContext || window.location.protocol === 'https:';
    },

    /**
     * 音声認識の初期化
     */
    init() {
        // Web Speech API対応チェック
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.warn('[Speech] Web Speech API not supported');
            return false;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'ja-JP';
        this.recognition.continuous = false;
        this.recognition.interimResults = true;

        // イベントハンドラ
        this.recognition.onstart = () => {
            console.log('[Speech] Recognition started');
            this.isListening = true;
            AppState.ui.isListening = true;
        };

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            // 中間結果
            if (interimTranscript && this.onInterim) {
                this.onInterim(interimTranscript);
            }

            // 最終結果
            if (finalTranscript && this.onResult) {
                this.onResult(finalTranscript);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('[Speech] Recognition error:', event.error);
            // エラー時も手動停止でなければ再試行したいが、
            // 無限ループ防止のため特定エラー以外は停止する
            if (event.error === 'no-speech' && !this.isManualStop) {
                return; // onendで再開させる
            }

            this.isListening = false;
            AppState.ui.isListening = false;

            if (this.onError) {
                let message = '音声を認識できませんでした';
                switch (event.error) {
                    case 'not-allowed':
                        message = 'マイクの使用が許可されていません';
                        break;
                    case 'no-speech':
                        message = '音声が検出されませんでした';
                        break;
                    case 'network':
                        message = 'ネットワークエラーが発生しました';
                        break;
                }
                this.onError(message, event.error);
            }
        };

        this.recognition.onend = () => {
            console.log('[Speech] Recognition ended');

            // 手動停止でない、かつリスニング状態であれば再開（自動継続）
            if (this.isListening && !this.isManualStop) {
                console.log('[Speech] Auto restarting...');
                try {
                    this.recognition.start();
                    return;
                } catch (e) {
                    console.error('[Speech] Restart failed:', e);
                }
            }

            this.isListening = false;
            this.isManualStop = false;
            AppState.ui.isListening = false;

            if (this.onEnd) {
                this.onEnd();
            }
        };

        return true;
    },

    /**
     * 音声認識開始
     */
    startListening() {
        // HTTP環境では音声認識不可
        if (!this.isSecureContext()) {
            console.warn('[Speech] Recognition requires HTTPS');
            return false;
        }

        if (!this.recognition) {
            if (!this.init()) {
                return false;
            }
        }

        this.isManualStop = false;

        try {
            this.recognition.start();
            return true;
        } catch (error) {
            console.error('[Speech] Failed to start:', error);
            return false;
        }
    },

    /**
     * 音声認識停止
     */
    stopListening() {
        if (this.recognition && this.isListening) {
            this.isManualStop = true;
            this.recognition.stop();
        }
    },

    /**
     * 音声リストがロードされるまで待機（タイムアウト付き）
     */
    async waitForVoices(timeoutMs = 3000) {
        return new Promise((resolve) => {
            if (!this.synthesis) { resolve([]); return; }
            const voices = this.synthesis.getVoices();
            if (voices.length > 0) { resolve(voices); return; }

            const timer = setTimeout(() => resolve([]), timeoutMs);
            this.synthesis.addEventListener('voiceschanged', () => {
                clearTimeout(timer);
                resolve(this.synthesis.getVoices());
            }, { once: true });
        });
    },

    /**
     * 音声読み上げ（改善版）
     */
    async speak(text, options = {}) {
        if (!this.synthesis) {
            console.warn('[Speech] Speech synthesis not supported');
            return;
        }

        // 読み上げ中なら停止
        this.synthesis.cancel();

        // 音声がロードされるまで待機
        const voices = await this.waitForVoices();
        const japaneseVoice = voices.find(v => v.lang.startsWith('ja'));

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ja-JP';
        utterance.rate = options.rate || 1.0;
        utterance.pitch = options.pitch || 1.0;
        utterance.volume = options.volume || 1.0;

        if (japaneseVoice) {
            utterance.voice = japaneseVoice;
        }

        return new Promise((resolve) => {
            utterance.onend = () => resolve();
            utterance.onerror = (e) => {
                console.error('[Speech] Synthesis error:', e);
                resolve();
            };
            this.synthesis.speak(utterance);
        });
    },

    /**
     * 読み上げ停止
     */
    stopSpeaking() {
        if (this.synthesis) {
            this.synthesis.cancel();
        }
    },

    /**
     * 音声認識がサポートされているか
     */
    isSupported() {
        return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    }
};
