# Voice KY Assistant v2

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

```bash
npm run dev:workers
```

#### Workers環境変数

- 必須: `OPENAI_API_KEY`
- 任意: `API_TOKEN`（API認証を有効にする場合）
- 予約済み（現状未使用）: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `WEATHER_API_BASE_URL`

#### フロントエンド環境変数

- 任意: `VITE_API_TOKEN`（Workers側で `API_TOKEN` を設定した場合）

### ビルド

```bash
npm run build
```

### デプロイ（Workers）

```bash
npm run deploy:workers
```

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
└── implementation_plan.md  # 実装計画
```

## 実装計画

詳細は [implementation_plan.md](./implementation_plan.md) を参照。

## 開発状況

- [x] プロジェクトスキャフォールド
- [x] Tailwind CSS + shadcn/ui セットアップ
- [x] Zustand状態管理
- [x] Honoバックエンド（OpenAI API連携）
- [x] 音声認識（Web Speech API）
- [x] 音声読み上げ（Web Speech API）
- [x] PDF出力（@react-pdf/renderer）
- [ ] Supabase認証 / データ永続化
