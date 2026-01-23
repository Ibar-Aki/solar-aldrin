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
          「${UI.escapeHtml(data.actionGoal) || 'ご安全に！'}」
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
     * PDF生成（html2canvas方式で日本語対応）
     */
    async generatePDF() {
        try {
            // ライブラリを動的ロード
            await this.loadLibraries();

            const session = AppState.session;
            const data = AppState.conversation.extractedData;
            const weather = session.weather;

            // PDF用のHTMLテンプレートを作成
            const template = document.createElement('div');
            template.id = 'pdf-template';
            template.style.cssText = `
                position: fixed;
                left: -9999px;
                top: 0;
                width: 794px;
                padding: 40px;
                background: white;
                font-family: 'Hiragino Kaku Gothic ProN', 'メイリオ', sans-serif;
                color: #333;
            `;

            template.innerHTML = `
                <h1 style="text-align: center; font-size: 24px; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px;">
                    危険予知活動記録
                </h1>
                
                <div style="margin-bottom: 20px; font-size: 14px;">
                    <p><strong>日時:</strong> ${UI.formatDate(session.startTime)}</p>
                    <p><strong>現場名:</strong> ${UI.escapeHtml(session.siteName) || '（未指定）'}</p>
                    <p><strong>作業内容:</strong> 足場設置</p>
                    ${weather ? `<p><strong>天候:</strong> ${UI.escapeHtml(weather.condition)} ${weather.temp}℃</p>` : ''}
                </div>
                
                <hr style="border: 1px solid #ddd; margin: 20px 0;">
                
                <div style="margin-bottom: 20px;">
                    <h2 style="font-size: 16px; color: #d32f2f; margin-bottom: 10px;">⚠️ 危険ポイント</h2>
                    <ul style="padding-left: 20px; font-size: 14px;">
                        ${data.hazards.map(h => `<li style="margin-bottom: 5px;">${UI.escapeHtml(h)}</li>`).join('')}
                    </ul>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <h2 style="font-size: 16px; color: #1976d2; margin-bottom: 10px;">🛡️ 対策</h2>
                    <ul style="padding-left: 20px; font-size: 14px;">
                        ${data.countermeasures.map(c => `<li style="margin-bottom: 5px;">${UI.escapeHtml(c)}</li>`).join('')}
                    </ul>
                </div>
                
                <div style="margin-bottom: 30px; padding: 15px; background: #fff3e0; border-radius: 8px; text-align: center;">
                    <h2 style="font-size: 16px; color: #e65100; margin-bottom: 10px;">🎯 本日の行動目標</h2>
                    <p style="font-size: 20px; font-weight: bold;">「${UI.escapeHtml(data.actionGoal) || 'ご安全に！'}」</p>
                </div>
                
                <hr style="border: 1px solid #ddd; margin: 20px 0;">
                
                <div style="font-size: 14px;">
                    <p style="margin-bottom: 15px;">作業員: _____________________ 印</p>
                    <p>確認者: _____________________ 印</p>
                </div>
            `;

            document.body.appendChild(template);

            // html2canvasでキャプチャ
            const canvas = await html2canvas(template, {
                scale: 2,
                useCORS: true,
                logging: false
            });

            document.body.removeChild(template);

            // jsPDFでPDF化
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const imgWidth = 210;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);

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
     * ライブラリを動的ロード
     */
    async loadLibraries() {
        const load = (src) => new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });

        if (!window.html2canvas) {
            await load('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
        }
        if (!window.jspdf) {
            await load('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        }
    }
};
