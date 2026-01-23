/**
 * 履歴画面
 */
const HistoryScreen = {
  render(container) {
    container.innerHTML = `
      ${UI.createHeader('📋 履歴')}
      
      <div class="screen">
        <div id="historyList" class="history-list">
          <div class="loading">
            <div class="loading-spinner"></div>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    await this.loadRecords();
  },

  /**
   * 記録を読み込み
   */
  async loadRecords() {
    const listEl = document.getElementById('historyList');

    try {
      const records = await Storage.getAllRecords();

      if (records.length === 0) {
        listEl.innerHTML = `
          <div class="history-empty">
            <div style="font-size:3rem;margin-bottom:16px;">📭</div>
            <p>まだ記録がありません</p>
          </div>
        `;
        return;
      }

      listEl.innerHTML = records.map(record => `
        <div class="history-item" data-id="${record.id}">
          <div class="history-item-icon">📋</div>
          <div class="history-item-content">
            <div class="history-item-date">${UI.formatDate(record.createdAt)}</div>
            <div class="history-item-summary">
              ${UI.escapeHtml(record.hazards && record.hazards[0] ? record.hazards[0] : '足場設置')}
            </div>
          </div>
          <div class="history-item-arrow">›</div>
        </div>
      `).join('');

      // クリックイベント
      listEl.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
          const id = item.dataset.id;
          this.showDetail(id);
        });
      });

    } catch (error) {
      console.error('[History] Failed to load:', error);
      listEl.innerHTML = `
        <div class="history-empty">
          <p>読み込みに失敗しました</p>
        </div>
      `;
    }
  },

  /**
   * 詳細表示
   */
  async showDetail(id) {
    try {
      const record = await Storage.getRecord(id);
      if (!record) return;

      // 簡易的にアラートで表示（将来的には専用画面）
      const info = `
日時: ${UI.formatDate(record.createdAt)}
天候: ${record.weather ? `${record.weather.condition} ${record.weather.temp}℃` : '不明'}

■ 危険
${record.hazards?.map(h => `・${h}`).join('\n') || 'なし'}

■ 対策
${record.countermeasures?.map(c => `・${c}`).join('\n') || 'なし'}

■ 合言葉
${record.actionGoal || 'なし'}
      `.trim();

      alert(info);

    } catch (error) {
      console.error('[History] Failed to load detail:', error);
    }
  }
};
