# Voice KY Assistant v2

更新日: 2026-02-07（実費テスト運用、/api/chat のJSONパース失敗時の扱いと観測情報を追記／ファイル整理：ドキュメント移動/リネーム）

Phase 2の音声KYアシスタントアプリ。

## 技術スタック

- **フロントエンド**: React 19 + TypeScript + Vite + React Router
- **UI**: Tailwind CSS + shadcn/ui + Lucide Icons
- **状態管理**: Zustand
- **音声**: Web Speech API（音声認識 / 読み上げ）
- **PDF**: @react-pdf/renderer
- **バックエンド**: Hono（Cloudflare Workers）
- **AI**: OpenAI Chat Completions API（gpt-4o-mini）
- **データベース**: Supabase（未接続・将来対応予定）

## 開発

### フロントエンド開発サーバー起動

```bash
cd apps/v2-modern
npm install
npm run dev
```

ブラウザで `http://localhost:5173/` を開く。

### Workers開発サーバー起動（OpenAI API）

#### 初回セットアップ

Workersの開発には`.dev.vars`ファイルが必要です：

```bash
# .dev.vars.example をコピー
cp .dev.vars.example .dev.vars

# .dev.vars を編集してOpenAI APIキーを設定
```

> [!IMPORTANT]
> `.dev.vars`には実際のAPIキーなどの機密情報が含まれるため、**絶対にGitにコミットしないでください**。
> このファイルは既に`.gitignore`に含まれています。

OpenAI APIキーの取得方法：

1. <https://platform.openai.com/api-keys> にアクセス
2. 「Create new secret key」をクリック
3. 生成されたキーを`.dev.vars`の`OPENAI_API_KEY`に設定

#### Workersサーバー起動

```bash
npm run dev:workers
```

#### Workers環境変数

- 必須: `OPENAI_API_KEY`
- 本番必須: `API_TOKEN`（`REQUIRE_API_TOKEN=1` または `SENTRY_ENV/ENVIRONMENT=production` の場合）
- 任意: `REQUIRE_API_TOKEN`（`1` で常時必須化、`0` で常時任意）
- 任意: `STRICT_CORS`（`1` で厳格CORS、`0` で開発許可を有効）
- 任意: `REQUIRE_RATE_LIMIT_KV`（`1` で `RATE_LIMIT_KV` 未設定時にフェイルクローズ）
- 予約済み（現状未使用）: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `WEATHER_API_BASE_URL`

#### フロントエンド環境変数

- 任意: `VITE_API_BASE_URL`（例: `https://voice-ky-v2.solar-aldrin-ky.workers.dev/api`）
- 任意: `VITE_API_TOKEN`（Workers側で `API_TOKEN` を設定した場合）

#### /api/chat のエラーコードと観測用フィールド（実費テスト向け）

- JSONパース失敗（LLM出力がJSONとして不正）: `502` / `code=AI_RESPONSE_INVALID_JSON` / `retriable=true`
- 成功レスポンスには、実費テスト解析向けに観測用フィールドを付与します（フロントの型検証では未使用ですが、E2Eレポートで採取します）
- 観測用フィールド: `usage.totalTokens`
- 観測用フィールド: `meta.openai.requestCount`（/api/chat 内での OpenAI 呼び出し回数）
- 観測用フィールド: `meta.openai.httpAttempts`（OpenAI HTTP 試行回数。内部リトライ込み）
- 観測用フィールド: `meta.openai.durationMs`（OpenAI 呼び出しの合計時間）
- 観測用フィールド: `meta.parseRetry.attempted` / `meta.parseRetry.succeeded`（JSONパース再試行の有無と結果）

### ビルド

```bash
npm run build
```

### デプロイ（Workers）

```bash
npm run deploy:workers
```

### デプロイ（Pages）

```bash
npm run build
npm run deploy:pages
```

### セキュリティ運用の一括実行

```bash
npx wrangler login
npm run security:ops -- -AllowedOrigins "https://voice-ky-v2.pages.dev,https://your-domain.example" -BaseUrl "https://voice-ky-v2.solar-aldrin-ky.workers.dev"
```

- `security:ops` は本番向けのセキュリティ設定反映、ローカル検証、デプロイ、スモークテストを順番に実行します。
- 事前に `RATE_LIMIT_KV` バインディングが本番環境に設定されていることを確認してください。

### 実費テスト（本番直結）

基本は `npm run test:cost:ops` だけで実行できます（`wrangler.toml` の `name` から Pages URL を推測します）。

```bash
npm run test:cost:ops
```

- 明示的に指定したい場合:

```bash
set LIVE_BASE_URL=https://voice-ky-v2.pages.dev
set VITE_API_TOKEN=<your_api_token>
npm run test:cost:ops
```

- `test:cost:ops` は `preflight` -> `Mobile Safari 実費E2E` -> `性能サマリ再生成` を連続実行します。
- `RUN_LIVE_TESTS=1` は `test:cost:live` 内で自動設定されます。

#### レポート整理（履歴圧縮）

```bash
npm run reports:prune
```

- `reports/real-cost` 配下を `mode(LIVE/DRY-RUN/test) + 日付` ごとに最新1件だけ残します。
- 実行ログは `reports/real-cost/prune-log-YYYY-MM-DD.md` に保存されます。

## ディレクトリ構造

```text
apps/v2-modern/
├── src/
│   ├── components/      # UI / PDFコンポーネント
│   ├── hooks/           # チャット・音声・PDFフック
│   ├── pages/           # ページコンポーネント
│   ├── stores/          # Zustandストア
│   ├── types/           # TypeScript型定義
│   └── lib/             # API / ユーティリティ
├── workers/             # Hono API (Cloudflare Workers)
├── tests/               # Vitest / Playwright
├── public/              # 静的ファイル
└── docs/00_planning/phases/phase2-implementation-plan.md  # 実装計画
```

## 実装計画

詳細は [docs/00_planning/phases/phase2-implementation-plan.md](./docs/00_planning/phases/phase2-implementation-plan.md) を参照。

## 開発状況

- [x] プロジェクトスキャフォールド
- [x] Tailwind CSS + shadcn/ui セットアップ
- [x] Zustand状態管理
- [x] Honoバックエンド（OpenAI API連携）
- [x] 音声認識（Web Speech API）
- [x] 音声読み上げ（Web Speech API）
- [x] PDF出力（@react-pdf/renderer）
- [ ] Supabase認証 / データ永続化

