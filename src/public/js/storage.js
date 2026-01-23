/**
 * ローカルストレージ / IndexedDB 管理
 */
const Storage = {
    db: null,
    isReady: false,
    DB_NAME: 'VoiceKYDB',
    DB_VERSION: 1,
    STORE_DRAFTS: 'ky_drafts',
    STORE_RECORDS: 'ky_records',

    /**
     * IndexedDB初期化
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onerror = () => {
                console.error('[Storage] Failed to open IndexedDB');
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.isReady = true;
                console.log('[Storage] IndexedDB initialized');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 下書きストア
                if (!db.objectStoreNames.contains(this.STORE_DRAFTS)) {
                    const draftsStore = db.createObjectStore(this.STORE_DRAFTS, { keyPath: 'sessionId' });
                    draftsStore.createIndex('syncStatus', 'syncStatus', { unique: false });
                }

                // 完了記録ストア
                if (!db.objectStoreNames.contains(this.STORE_RECORDS)) {
                    const recordsStore = db.createObjectStore(this.STORE_RECORDS, { keyPath: 'id' });
                    recordsStore.createIndex('createdAt', 'createdAt', { unique: false });
                    recordsStore.createIndex('syncStatus', 'syncStatus', { unique: false });
                }
            };
        });
    },

    /**
     * 下書き保存
     */
    async saveDraft(draft) {
        if (!this.isReady) return Promise.reject(new Error('IndexedDB not initialized'));
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.STORE_DRAFTS, 'readwrite');
            const store = tx.objectStore(this.STORE_DRAFTS);
            const request = store.put({
                ...draft,
                updatedAt: new Date().toISOString()
            });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * KY記録を保存
     */
    async saveRecord(record) {
        if (!this.isReady) return Promise.reject(new Error('IndexedDB not initialized'));
        const recordWithMeta = {
            id: record.id || generateUUID(),
            createdAt: record.createdAt || new Date().toISOString(),
            syncStatus: 'pending',
            syncAttempts: 0,
            ...record
        };

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.STORE_RECORDS, 'readwrite');
            const store = tx.objectStore(this.STORE_RECORDS);
            const request = store.put(recordWithMeta);

            request.onsuccess = () => {
                console.log('[Storage] Record saved:', recordWithMeta.id);
                resolve(recordWithMeta);
            };
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * 全記録を取得（新しい順）
     */
    async getAllRecords() {
        if (!this.isReady) return Promise.reject(new Error('IndexedDB not initialized'));
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.STORE_RECORDS, 'readonly');
            const store = tx.objectStore(this.STORE_RECORDS);
            const index = store.index('createdAt');
            const request = index.getAll();

            request.onsuccess = () => {
                const records = request.result.reverse(); // 新しい順
                resolve(records);
            };
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * 未同期の記録を取得
     */
    async getPendingRecords() {
        if (!this.isReady) return Promise.reject(new Error('IndexedDB not initialized'));
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.STORE_RECORDS, 'readonly');
            const store = tx.objectStore(this.STORE_RECORDS);
            const index = store.index('syncStatus');
            const request = index.getAll('pending');

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * 同期ステータス更新
     */
    async updateSyncStatus(id, status, error = null) {
        if (!this.isReady) return Promise.reject(new Error('IndexedDB not initialized'));
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.STORE_RECORDS, 'readwrite');
            const store = tx.objectStore(this.STORE_RECORDS);
            const getRequest = store.get(id);

            getRequest.onsuccess = () => {
                const record = getRequest.result;
                if (record) {
                    record.syncStatus = status;
                    record.syncAttempts = (record.syncAttempts || 0) + 1;
                    record.lastSyncError = error;
                    record.lastSyncAt = new Date().toISOString();

                    const putRequest = store.put(record);
                    putRequest.onsuccess = () => resolve();
                    putRequest.onerror = () => reject(putRequest.error);
                } else {
                    resolve();
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    },

    /**
     * 未同期データをサーバーに同期
     */
    async syncPendingRecords() {
        try {
            if (!this.isReady) throw new Error('IndexedDB not initialized');
            const pending = await this.getPendingRecords();
            console.log(`[Storage] Syncing ${pending.length} pending records...`);

            for (const record of pending) {
                if (record.syncAttempts >= 3) {
                    await this.updateSyncStatus(record.id, 'failed', 'Max attempts reached');
                    continue;
                }

                try {
                    await API.saveRecord(record);
                    await this.updateSyncStatus(record.id, 'synced');
                    console.log(`[Storage] Synced: ${record.id}`);
                } catch (err) {
                    await this.updateSyncStatus(record.id, 'pending', err.message);
                    console.warn(`[Storage] Sync failed: ${record.id}`, err);
                }
            }
        } catch (err) {
            console.error('[Storage] Sync error:', err);
        }
    },

    /**
     * 特定の記録を取得
     */
    async getRecord(id) {
        if (!this.isReady) return Promise.reject(new Error('IndexedDB not initialized'));
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.STORE_RECORDS, 'readonly');
            const store = tx.objectStore(this.STORE_RECORDS);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
};
