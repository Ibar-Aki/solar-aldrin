# System Architecture

**統合先**: `./30_design/01_System_Architecture.md`  
本ファイルは概要のみを維持します。詳細設計は統合先を参照してください。
更新日: 2026-02-25（AIプロバイダ表記とデータフロー説明を現行実装に合わせて更新）

Voice KY Assistant v2 のシステム構成図です。

```mermaid
graph TD
    %% ノード定義
    User[👤 現場作業員]
    Browser[📱 Client Device<br/>(iOS/Android/PC)]
    
    subgraph "Cloudflare Edge Network"
        Pages[⚡ Cloudflare Pages<br/>(Static Assets Hosting)]
        Workers[🐝 Cloudflare Workers<br/>(Serverless API)]
        KV[🗄️ Workers KV<br/>(Rate Limiting)]
    end
    
    subgraph "External Services"
        OpenAI[🧠 OpenAI API<br/>(gpt-4o-mini)]
        Gemini[✨ Gemini API<br/>(gemini-2.5-flash / OpenAI互換endpoint)]
    end

    subgraph "Client Storage"
        IndexedDB[💾 IndexedDB<br/>(Dexie.js)]
    end

    %% フロー
    User -->|Voice Input / Touch| Browser
    Browser -->|HTTPS Request (Load App)| Pages
    Browser -->|API Request (Chat/Extract)| Workers
    
    Workers -->|Check Limit| KV
    Workers -->|Inference Request| OpenAI
    Workers -->|Inference Request| Gemini
    OpenAI -->|JSON Response| Workers
    Gemini -->|JSON Response| Workers
    Workers -->|Sanitized Response| Browser
    
    Browser -->|Save Session| IndexedDB
    IndexedDB -->|Load History| Browser
    Browser -->|Generate PDF| PDF[📄 PDF Document<br/>(Client-Side Generation)]
    Browser -->|Export| Export[📊 CSV/JSON<br/>(エクスポート)]
```

## データフロー概要

1. **フロントエンド配信**: ユーザーがアクセスすると、世界中の最寄りエッジから静的ファイルが配信されます (Cloudflare Pages)。
2. **API処理**: チャット送信時、リクエストは `Cloudflare Workers` (Hono) で処理されます。
   - **レート制限**: `Workers KV` を利用（未バインド時はメモリフォールバック、`REQUIRE_RATE_LIMIT_KV=1` なら503で遮断）。
   - **プロンプト構築**: サーバー側でシステムプロンプトと補助コンテキストを組み立てます。
3. **AI推論**: `AI_PROVIDER` 設定に応じて `OpenAI` または `Gemini`（OpenAI互換endpoint）へ送信し、Workers経由でクライアントに返します。
4. **ローカル保存**: セッションデータは `IndexedDB (Dexie.js)` に永続化されます。
5. **PDF生成/エクスポート**: 最終的なデータはブラウザ上で処理され、PDF化またはCSV/JSONエクスポートされます。

