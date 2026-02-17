# Phase 2 (v2-modern) セットアップガイド

作成日時: 2026-02-18 00:41
作成者: Codex＋GPT-5
更新日: 2026-02-17（v2-modern 現行構成と iPhone 実機テスト手順へ更新）

Voice KY Assistant v2 の開発環境セットアップ、デプロイ、iPhone 実機確認までを一連でまとめた手順です。

## 1. 前提

- Node.js 20 以上
- Cloudflare アカウント（Workers / Pages）
- `wrangler` ログイン済み（`npx wrangler login`）

```bash
cd apps/v2-modern
npm install
```

## 2. フォント配置（PDF）

PDF生成で利用する `NotoSansJP-Regular.ttf` を配置します。

1. Google Fonts から Noto Sans JP を取得
2. `NotoSansJP-Regular.ttf` を次へ配置
   - `apps/v2-modern/public/fonts/NotoSansJP-Regular.ttf`

## 3. Workers 用のローカル設定（.dev.vars）

`.dev.vars.example` を複製して `.dev.vars` を作成し、使用するAIプロバイダのキーを設定します。

```bash
cp .dev.vars.example .dev.vars
```

主な設定:

- `AI_PROVIDER=openai` の場合: `OPENAI_API_KEY`
- `AI_PROVIDER=gemini` の場合: `GEMINI_API_KEY`
- 認証必須運用にする場合: `API_TOKEN` と `REQUIRE_API_TOKEN=1`

## 4. ローカル開発起動

フロントとWorkersを同時起動:

```bash
npm run dev:all
```

個別起動したい場合:

```bash
npm run dev
npm run dev:workers
```

ローカルアクセス:

- フロント: `http://localhost:5173`
- Workers: `http://localhost:8787`

## 5. 本番デプロイ（iPhone確認向け）

```bash
cd apps/v2-modern
npm run deploy:workers
npm run deploy:pages
```

確認URL:

- フロント（Pages）: `https://voice-ky-v2.pages.dev`
- API（Workers）: `https://voice-ky-v2.solar-aldrin-ky.workers.dev/api`

## 6. iPhone 実機確認

1. iPhone の Safari で `https://voice-ky-v2.pages.dev` を開く
2. マイク権限を許可
3. 「通常モード / 完全音声会話」を選んで KY 開始
4. 必要に応じて「ホーム画面に追加」でPWA化

## 7. よくある詰まりどころ

- API応答が失敗する:
  - Workers のキー設定（`OPENAI_API_KEY` / `GEMINI_API_KEY`）を再確認
- 認証エラーになる:
  - `REQUIRE_API_TOKEN` と `API_TOKEN` の組み合わせを確認
- iPhoneでマイクが使えない:
  - HTTPS で開いているか、Safari のマイク許可が有効かを確認
