# Voice KY Assistant v2

Phase 2の音声KYアシスタントアプリ。

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS + Shadcn/ui
- **State Management**: Zustand
- **Backend**: Hono (Cloudflare Workers)
- **Database**: Supabase (予定)

## 開発

### フロントエンド開発サーバー起動

```bash
cd apps/v2-modern
npm install
npm run dev
```

ブラウザで `http://localhost:5173/` を開く。

### Workers開発サーバー起動

```bash
npm run dev:workers
```

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
│   ├── components/ui/   # shadcn/uiコンポーネント
│   ├── hooks/           # カスタムフック
│   ├── pages/           # ページコンポーネント
│   ├── stores/          # Zustandストア
│   ├── types/           # TypeScript型定義
│   └── lib/             # ユーティリティ
├── workers/             # Hono API (Cloudflare Workers)
├── public/              # 静的ファイル
└── implementation_plan.md  # 実装計画
```

## 実装計画

詳細は [implementation_plan.md](./implementation_plan.md) を参照。

## 開発状況

- [x] プロジェクトスキャフォールド
- [x] Tailwind CSS + shadcn/ui セットアップ
- [x] Zustand状態管理
- [x] Honoバックエンドスタブ
- [ ] 音声認識統合
- [ ] OpenAI API連携
- [ ] ハンズフリー機能
- [ ] PDF出力
- [ ] Supabase認証
