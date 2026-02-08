# Phase 2 (v2-modern) セットアップガイド

更新日: 2026-02-07

Voice KY Assistant v2 の開発環境セットアップとデプロイ手順です。

## 1. 必須アセットの配置 (フォント)

PDF生成機能で使用する日本語フォント (`NotoSansJP-Regular.ttf`) を配置する必要があります。
これがないとPDF生成時にエラーが発生します。

1. [Google Fonts: Noto Sans JP](https://fonts.google.com/specimen/Noto+Sans+JP) からフォントをダウンロードします。
2. ダウンロードしたzipを展開し、`static` フォルダ内の `NotoSansJP-Regular.ttf` を探します。
3. 以下のパスに配置します：
   `apps/v2-modern/public/fonts/NotoSansJP-Regular.ttf`

## 2. OpenAI APIキーの設定

Cloudflare Workers で OpenAI API を使用するためのAPIキーを設定します。

```bash
cd apps/v2-modern
npx wrangler secret put OPENAI_API_KEY
```

コマンド実行後、プロンプトに従って OpenAI のAPIキーを入力してください。

## 3. その他の環境変数 (オプション)

必要に応じて以下の環境変数も設定してください（Supabase連携など）。

```bash
# Supabase (将来的に使用)
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
```

## 4. 開発サーバーの起動

フロントエンド (Vite) とバックエンド (Workers) を両方起動する必要があります。
それぞれ別のターミナルで実行してください。

### ターミナル1: フロントエンド (UI)

```bash
cd apps/v2-modern
npm run dev
```

→ `http://localhost:5173` でアクセス可能になります。

### ターミナル2: バックエンド (API)

```bash
cd apps/v2-modern
npm run dev:workers
```

→ `http://localhost:8787` でAPIサーバーが起動します。

## 5. 動作確認

1. ブラウザで `http://localhost:5173` にアクセス。
2. 「KY活動を開始」ボタンを押下。
3. チャット画面でメッセージを送信し、AIから応答が返ってくるか確認。
   - ※Workersが起動していないと通信エラーになります。
   - ※APIキーが設定されていないとOpenAIエラーになります。
4. 全工程終了後、PDFダウンロードを試し、正常に出力されるか確認。

## 6. デプロイ

Cloudflare Pages と Workers にデプロイします。

### Workers (API) のデプロイ

```bash
cd apps/v2-modern
npm run deploy:workers
```

### フロントエンド (Pages) のデプロイ

GitHub連携を行っていない場合は、ビルドして手動デプロイ（またはWrangler経由）を行います。

```bash
npm run build
npx wrangler pages deploy dist --project-name voice-ky-assistant
```

※初回はプロジェクト作成が必要になる場合があります。
