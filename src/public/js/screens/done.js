/**
 * 完了画面
 */
const DoneScreen = {
    render(container) {
        const data = AppState.conversation.extractedData;

        container.innerHTML = `
      <div class="screen done">
        <div class="done-icon">✅</div>
        <h1 class="done-title">KY完了！</h1>
        <p class="done-message">ご安全に！</p>
        
        <div class="done-goal" style="font-size:1.5rem;font-weight:bold;margin-bottom:32px;">
          「${data.actionGoal || 'ご安全に！'}」
        </div>
        
        <div class="done-actions">
          <button class="btn btn-primary btn-large" id="pdfBtn">📄 PDFを表示</button>
          <button class="btn btn-secondary btn-large" id="homeBtn">🏠 ホームに戻る</button>
        </div>
      </div>
    `;
    },

    init() {
        document.getElementById('pdfBtn').addEventListener('click', () => {
            this.generatePDF();
        });

        document.getElementById('homeBtn').addEventListener('click', () => {
            Router.navigate('home');
        });
    },

    /**
     * PDF生成
     */
    async generatePDF() {
        try {
            // jsPDFを動的ロード
            if (!window.jspdf) {
                await this.loadJsPDF();
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const session = AppState.session;
            const data = AppState.conversation.extractedData;
            const weather = session.weather;

            // 日本語フォント設定（デフォルトフォントを使用）
            doc.setFont('helvetica');

            let y = 20;

            // タイトル
            doc.setFontSize(18);
            doc.text('KY活動記録', 105, y, { align: 'center' });
            y += 15;

            // 基本情報
            doc.setFontSize(12);
            doc.text(`日時: ${UI.formatDate(session.startTime)}`, 20, y);
            y += 8;
            doc.text(`作業: 足場設置`, 20, y);
            y += 8;
            if (weather) {
                doc.text(`天候: ${weather.condition} ${weather.temp}°C`, 20, y);
                y += 8;
            }
            y += 5;

            // 区切り線
            doc.line(20, y, 190, y);
            y += 10;

            // 危険
            doc.setFontSize(14);
            doc.text('■ 危険', 20, y);
            y += 8;
            doc.setFontSize(11);
            data.hazards.forEach(h => {
                doc.text(`・${h}`, 25, y);
                y += 7;
            });
            y += 5;

            // 対策
            doc.setFontSize(14);
            doc.text('■ 対策', 20, y);
            y += 8;
            doc.setFontSize(11);
            data.countermeasures.forEach(c => {
                doc.text(`・${c}`, 25, y);
                y += 7;
            });
            y += 5;

            // 合言葉
            doc.setFontSize(14);
            doc.text('■ 合言葉', 20, y);
            y += 8;
            doc.setFontSize(12);
            doc.text(data.actionGoal || '', 25, y);
            y += 15;

            // 区切り線
            doc.line(20, y, 190, y);
            y += 10;

            // 署名欄
            doc.setFontSize(12);
            doc.text('作業員: ___________________  印', 20, y);
            y += 12;
            doc.text('確認者: ___________________  印', 20, y);

            // PDF表示
            const pdfBlob = doc.output('blob');
            const url = URL.createObjectURL(pdfBlob);
            window.open(url, '_blank');

        } catch (error) {
            console.error('[Done] PDF generation failed:', error);
            UI.showError('PDF生成に失敗しました');
        }
    },

    /**
     * jsPDFを動的ロード
     */
    loadJsPDF() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
};
