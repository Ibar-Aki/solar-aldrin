# Voice KY Assistant 実装詳細ドキュメント

**統合先（Phase 2.1-2.5設計）**: `../30_design/`  
本書は旧実装の詳細を含みます。現行設計は統合先の設計書を参照してください。

## 1. システム概要

### アーキテクチャ

本システムは、クライアントサイド(PWA)とサーバーレスバックエンド(Cloudflare Workers)で構成されるモダンなWebアプリケーションです。

```mermaid
graph TD
    User[ユーザー (iPhone/PC)] -->|HTTPS| PWA[PWAフロントエンド (Cloudflare Pages)]
    PWA -->|API Request| Workers[Cloudflare Workers API]
    PWA -->|Web Speech API| Browser[ブラウザ音声機能]
    
    subgraph Client
        PWA -->|Cache| SW[Service Worker]
        PWA -->|Store| IDB[IndexedDB (Local Storage)]
    end
    
    subgraph Backend
        Workers -->|Chat/Advice| OpenAI[OpenAI API (GPT-4o-mini)]
        Workers -->|Weather| OWM[OpenWeatherMap API]
        Workers -->|Persist| Supabase[Supabase DB]
    end
```

## 2. ディレクトリ構成

```
src/
├── public/                # フロントエンド (Static Assets)
│   ├── index.html         # エントリーポイント
│   ├── manifest.json      # PWA設定
│   ├── sw.js              # Service Worker
│   ├── css/               # スタイル
│   │   ├── reset.css
│   │   └── app.css        # メインスタイル（CSS変数活用）
│   ├── js/                # ロジック
│   │   ├── main.js        # 初期化
│   │   ├── state.js       # 状態管理 (AppState)
│   │   ├── router.js      # ルーティング (SPA)
│   │   ├── ui.js          # UIユーティリティ
│   │   ├── api.js         # APIクライアント
│   │   ├── storage.js     # IndexedDBラッパー
│   │   ├── speech.js      # 音声認識/合成ラッパー
│   │   └── screens/       # 各画面ロジック
│   │       ├── home.js
│   │       ├── chat.js
│   │       ├── confirm.js
│   │       ├── done.js
│   │       └── history.js
│   └── assets/            # 画像・アイコン
└── workers/               # バックエンド
    ├── index.js           # APIハンドラ
    └── wrangler.toml      # Workers設定
```

## 3. API仕様

Base URL: `https://<worker-domain>` (Dev: `http://localhost:8787`)

### 3.1 AI対話 (`POST /api/chat`)

- **概要**: ユーザーの入力に対してAIが応答し、対話フェーズを進行させる。
- **Request**:

  ```json
  {
    "sessionId": "uuid",
    "message": "足場から落ちそう",
    "context": {
      "history": [{"role": "assistant", "content": "..."}],
      "weather": {...}
    }
  }
  ```

- **Response**:

  ```json
  {
    "reply": "それは危険ですね。対策はありますか？",
    "phase": "counter_measure",
    "done": false,
    "data": {
      "hazards": ["墜落"],
      "countermeasures": [],
      "goal": null
    }
  }
  ```

### 3.2 アドバイス取得 (`POST /api/advice`)

- **概要**: 抽出されたKY内容に対して、AIが改善アドバイスを生成する。
- **Response**:

  ```json
  {
    "advices": [
      {"type": "good", "text": "具体的な危険予知ができています！"},
      {"type": "tip", "text": "対策に「指差呼称」を入れるとより良いです。"}
    ]
  }
  ```

### 3.3 記録保存 (`POST /api/records`)

- **概要**: 完了したKY記録をデータベースに保存する。Cloudflare Workersから直接SupabaseへRESTリクエストを行う。

## 4. データモデル

### 4.1 IndexedDB (`ky_records` ストア)

オフライン動作を保証するため、全ての完了記録はまずローカルのIndexedDBに保存される。

| キー | 型 | 説明 |
|---|---|---|
| `id` | string | UUID (主キー) |
| `createdAt` | string | 作成日時 (ISO8601) |
| `syncStatus` | string | `pending` | `synced` | `failed` |
| `hazards` | array | 危険リスト |
| `countermeasures` | array | 対策リスト |
| `actionGoal` | string | 合言葉 |
| ... | ... | その他メタデータ |

### 4.2 Supabase (`ky_records` テーブル)

サーバー側の永続化ストレージ。

| カラム名 | 型 | 説明 |
|---|---|---|
| `id` | uuid | PK |
| `created_at` | timestamptz | 作成日時 |
| `site_name` | text | 現場名 |
| `hazards` | jsonb | 危険リスト |
| `countermeasures` | jsonb | 対策リスト |
| ... | ... | |

## 5. 主要ロジック詳細

### 5.1 音声認識の継続 (`speech.js`)

Web Speech APIは無音検知で自動的に停止する仕様があるため、`speech.js` では `onend` イベントをフックし、意図的な停止（`stopListening()` 呼び出し）でない限り、即座に `start()` を呼び直すことで、擬似的な連続音声認識を実現している。

### 5.2 オフライン同期 (`storage.js` + `sw.js`)

1. **保存**: `ConfirmScreen` で完了時、`Storage.saveRecord()` でIndexedDBに `syncStatus: 'pending'` として保存。
2. **即時同期**: ネットワークがあればその場で `API.saveRecord()` を試行。成功すれば `synced` に更新。
3. **バックグラウンド同期**: Service Workerの `sync` イベント（対応ブラウザ）またはアプリ起動時の `Main.init()` で、`pending` 状態のレコードを一括送信する。
