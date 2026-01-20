/**
 * UI ユーティリティ
 */
const UI = {
    /**
     * ローディング表示
     */
    showLoading(container, message = '読み込み中...') {
        container.innerHTML = `
      <div class="loading">
        <div class="loading-spinner"></div>
        <p>${message}</p>
      </div>
    `;
    },

    /**
     * トースト通知
     */
    showToast(message, type = 'default', duration = 3000) {
        // 既存のトーストを削除
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, duration);
    },

    /**
     * エラー表示
     */
    showError(message) {
        this.showToast(message, 'error', 4000);
    },

    /**
     * 成功表示
     */
    showSuccess(message) {
        this.showToast(message, 'success', 2000);
    },

    /**
     * ヘッダーを作成
     */
    createHeader(title, showBack = true) {
        return `
      <header class="header">
        ${showBack ? '<button class="header-back" onclick="Router.back()">←</button>' : '<div style="width:44px"></div>'}
        <h1 class="header-title">${title}</h1>
        <div style="width:44px"></div>
      </header>
    `;
    },

    /**
     * 日付フォーマット
     */
    formatDate(isoString) {
        const date = new Date(isoString);
        return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    },

    /**
     * 天候アイコン
     */
    getWeatherIcon(condition) {
        const icons = {
            '晴れ': '☀️',
            '曇り': '☁️',
            '雨': '🌧️',
            '雪': '❄️',
            '霧': '🌫️'
        };
        return icons[condition] || '🌤️';
    },

    /**
     * HTMLエスケープ（XSS対策）
     */
    escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
};
