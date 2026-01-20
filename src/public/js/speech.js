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
            this.isListening = false;
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
        if (!this.recognition) {
            if (!this.init()) {
                UI.showError('この端末では音声認識を利用できません');
                return false;
            }
        }

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
            this.recognition.stop();
        }
    },

    /**
     * 音声読み上げ
     */
    speak(text, options = {}) {
        return new Promise((resolve, reject) => {
            if (!this.synthesis) {
                console.warn('[Speech] Speech synthesis not supported');
                resolve();
                return;
            }

            // 読み上げ中なら停止
            this.synthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ja-JP';
            utterance.rate = options.rate || 1.0;
            utterance.pitch = options.pitch || 1.0;
            utterance.volume = options.volume || 1.0;

            // 日本語音声を探す
            const voices = this.synthesis.getVoices();
            const japaneseVoice = voices.find(v => v.lang.startsWith('ja'));
            if (japaneseVoice) {
                utterance.voice = japaneseVoice;
            }

            utterance.onend = () => resolve();
            utterance.onerror = (e) => {
                console.error('[Speech] Synthesis error:', e);
                resolve(); // エラーでも続行
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
