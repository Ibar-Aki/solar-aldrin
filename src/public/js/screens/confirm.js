/**
 * 確認画面
 */
const ConfirmScreen = {
    render(container) {
        const session = AppState.session;
        const data = AppState.conversation.extractedData;
        const weather = session.weather;
        const advice = AppState.advice;

        container.innerHTML = `
      ${UI.createHeader('✅ KY確認')}
      
      <div class="screen confirm">
        <div class="confirm-meta">
          <span>📅 ${UI.formatDate(session.startTime)}</span>
          ${weather ? `<span>${UI.getWeatherIcon(weather.condition)} ${weather.condition} ${weather.temp}℃</span>` : ''}
        </div>
        
        <!-- 危険 -->
        <div class="confirm-section">
          <div class="confirm-section-title">⚠️ 危険</div>
          <div class="confirm-section-content">
            ${data.hazards.length > 0
                ? data.hazards.map(h => `<div class="confirm-hazard-item">・${h}</div>`).join('')
                : '<div class="text-muted">（記載なし）</div>'
            }
          </div>
        </div>
        
        <!-- 対策 -->
        <div class="confirm-section">
          <div class="confirm-section-title">✅ 対策</div>
          <div class="confirm-section-content">
            ${data.countermeasures.length > 0
                ? data.countermeasures.map(c => `<div class="confirm-counter-item">・${c}</div>`).join('')
                : '<div class="text-muted">（記載なし）</div>'
            }
          </div>
        </div>
        
        <!-- 合言葉 -->
        <div class="confirm-section">
          <div class="confirm-section-title">🎯 合言葉</div>
          <div class="confirm-section-content">
            <div class="confirm-goal">${data.actionGoal || '（未設定）'}</div>
          </div>
        </div>
        
        <!-- アドバイス -->
        ${advice.length > 0 ? `
          <div class="advice-card">
            <div class="advice-card-title">💡 KYアドバイス</div>
            ${advice.map(a => `
              <div class="advice-item">${a.type === 'good' ? '✨' : '💡'} ${a.text}</div>
            `).join('')}
          </div>
        ` : ''}
        
        <!-- アクション -->
        <div class="confirm-actions">
          <button class="btn btn-secondary" id="editBtn">✏️ 修正</button>
          <button class="btn btn-primary" id="completeBtn">✅ 完了</button>
        </div>
      </div>
    `;
    },

    init() {
        document.getElementById('editBtn').addEventListener('click', () => {
            // 対話画面に戻る（履歴を維持）
            Router.navigate('chat');
        });

        document.getElementById('completeBtn').addEventListener('click', async () => {
            await this.complete();
        });
    },

    /**
     * KY完了処理
     */
    async complete() {
        const session = AppState.session;
        const data = AppState.conversation.extractedData;

        // 記録データ作成
        const record = {
            id: session.id,
            createdAt: session.startTime,
            workType: session.workType,
            siteName: session.siteName,
            weather: session.weather,
            hazards: data.hazards,
            countermeasures: data.countermeasures,
            actionGoal: data.actionGoal,
            durationSec: Math.floor((Date.now() - new Date(session.startTime).getTime()) / 1000),
            advice: AppState.advice,
            conversationLog: AppState.conversation.messages
        };

        try {
            // ローカル保存
            await Storage.saveRecord(record);

            // サーバー同期を試みる
            try {
                await API.saveRecord(record);
                await Storage.updateSyncStatus(record.id, 'synced');
            } catch (e) {
                console.warn('[Confirm] Server sync failed, will retry later');
            }

            // 完了画面へ
            Router.navigate('done');
        } catch (error) {
            console.error('[Confirm] Failed to save:', error);
            UI.showError('保存に失敗しました');
        }
    }
};
