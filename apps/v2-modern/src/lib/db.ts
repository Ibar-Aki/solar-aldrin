/**
 * IndexedDB データベース設定 (Dexie.js)
 * Phase 2.3: 履歴管理・データ永続化
 */
import Dexie, { type Table } from 'dexie'
import type { SoloKYSession } from '@/types/ky'

function normalizeSession(session: SoloKYSession): SoloKYSession {
    // Backward compatibility: old records may store countermeasures as string[].
    const workItems = session.workItems.map((item) => {
        const raw = (item as unknown as { countermeasures?: unknown }).countermeasures
        if (Array.isArray(raw) && raw.every((v) => typeof v === 'string')) {
            const normalized = (raw as string[])
                .map((text) => String(text).trim())
                .filter(Boolean)
                .map((text) => ({ category: 'behavior' as const, text }))
            return { ...item, countermeasures: normalized } as unknown as typeof item
        }
        return item
    })
    return { ...session, workItems }
}

/**
 * Voice KY データベース
 * - sessions: 完了したKYセッションを保存
 */
export class KYDatabase extends Dexie {
    sessions!: Table<SoloKYSession, string>

    constructor() {
        super('VoiceKYDatabase')

        // スキーマ定義
        // id: プライマリキー
        // createdAt, siteName, userName: インデックス（検索・ソート用）
        this.version(1).stores({
            sessions: 'id, createdAt, siteName, userName'
        })
    }
}

// FIX-07: 遅延初期化パターン（テスト時のモックを容易にする）
let _db: KYDatabase | null = null

function getDb(): KYDatabase {
    if (!_db) {
        _db = new KYDatabase()
    }
    return _db
}

// 後方互換のためのエクスポート
export const db = { get sessions() { return getDb().sessions } }

/**
 * セッションを保存（冪等: 同一IDは上書き）
 * レビュー指摘: add ではなく put を使用
 */
export async function saveSession(session: SoloKYSession): Promise<void> {
    await getDb().sessions.put(session)
}

/**
 * 全セッションを取得（降順）
 */
export async function getAllSessions(): Promise<SoloKYSession[]> {
    const sessions = await getDb().sessions.orderBy('createdAt').reverse().toArray()
    return sessions.map(normalizeSession)
}

/**
 * 最新のセッションを取得
 */
export async function getLatestSession(): Promise<SoloKYSession | undefined> {
    const session = await getDb().sessions.orderBy('createdAt').reverse().first()
    return session ? normalizeSession(session) : undefined
}

/**
 * IDでセッションを取得
 */
export async function getSessionById(id: string): Promise<SoloKYSession | undefined> {
    const session = await getDb().sessions.get(id)
    return session ? normalizeSession(session) : undefined
}

/**
 * セッションを削除
 */
export async function deleteSession(id: string): Promise<void> {
    await getDb().sessions.delete(id)
}

/**
 * セッション数を取得
 * FIX-09: 現在未使用だが、履歴一覧での統計表示やページネーションで将来使用予定
 */
export async function getSessionCount(): Promise<number> {
    return getDb().sessions.count()
}

