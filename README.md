# Voice KY Assistant

🏗️ 音声でKY活動を完了するPWAアプリ

> **Demo:** [Voice KY Assistant](https://voice-ky-assistant.pages.dev)

## 概要

建設現場の作業員が、音声対話を通じてKY（危険予知）活動を簡単に実施できるアプリケーションです。AIアシスタント「KY記録くん」が対話をファシリテートし、危険・対策・合言葉を記録してPDF出力します。

## 特徴

- 📱 **PWA対応** - ホーム画面に追加してネイティブアプリのように使用
- 🎙️ **音声ファースト** - 手が塞がっていても操作可能
- 📝 **テキストフォールバック** - 騒音環境でもテキスト入力で対応
- 📄 **PDF出力** - 監査用の記録をPDFで保存
- 📶 **オフライン対応** - 電波が悪い現場でも使用可能

## 技術スタック

| 領域 | 技術 |
|------|------|
| フロントエンド | Vanilla JS + PWA |
| 音声認識 | Web Speech API |
| バックエンド | Cloudflare Workers |
| AI | OpenAI GPT-4o-mini |
| DB | Supabase (計画中) |
| 天候API | OpenWeatherMap |

## ディレクトリ構成

```
src/
├── public/           # フロントエンド（PWA）
│   ├── index.html    # エントリーポイント
│   ├── manifest.json # PWAマニフェスト
│   ├── sw.js         # Service Worker
│   ├── css/          # スタイルシート
│   ├── js/           # JavaScriptモジュール
│   └── assets/       # アイコン等
└── workers/          # Cloudflare Workers（バックエンド）
    ├── index.js      # APIエンドポイント
    └── wrangler.toml # Workers設定
```

## 開発

### 必要条件

- Node.js 18+
- Cloudflare Wrangler CLI（バックエンド開発時）

### ローカル開発

```bash
# フロントエンド（ローカルサーバー起動）
npm run dev

# バックエンド（Workersローカル起動）
npm run dev:workers
```

### デプロイ

```bash
# Cloudflare Workersにデプロイ
npm run deploy:workers

# Cloudflare Pagesにデプロイ
npm run deploy:pages
```

### 環境変数（Workers）

Cloudflareダッシュボードで以下を設定：

- `OPENAI_API_KEY` - OpenAI APIキー
- `WEATHER_API_KEY` - OpenWeatherMap APIキー
- `SUPABASE_URL` - Supabase URL（将来）
- `SUPABASE_KEY` - Supabase Key（将来）

## ドキュメント

- [企画書](docs/planning/01_企画書.md)
- [要件定義書](docs/planning/02_要件定義書.md)
- [徹底検証レポート](docs/planning/03_徹底検証レポート.md)
- [詳細設計書](docs/planning/04_詳細設計書.md)

## ライセンス

MIT
