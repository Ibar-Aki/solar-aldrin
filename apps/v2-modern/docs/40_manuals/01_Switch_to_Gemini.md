# Gemini API への切り替えガイド

現在のシステムは既に Gemini API に対応しており、コードの書き換えなしで設定変更のみで切り替えが可能です。
以下の手順に従って設定を行ってください。

## 1. Google AI Studio で API キーを取得する

1. [Google AI Studio (API Key)](https://aistudio.google.com/app/apikey) にアクセスし、Google アカウントでログインします。
2. **"Create API key"** をクリックします。
3. **"Create API key in new project"** を選択します（既存プロジェクトがある場合はそちらでも可）。
4. 生成されたキーをコピーします（`AIza` から始まる文字列）。

## 2. ローカル開発環境の設定 (`.dev.vars`)

プロジェクトルートの `.dev.vars` ファイルを開き、以下の行を追加・変更します。

```env
# 既存の OpenAI 設定は残しておいて構いません
# AI_PROVIDER を gemini にすると Gemini が優先されます

AI_PROVIDER="gemini"
GEMINI_API_KEY="ここにコピーしたAIzaから始まるキーを貼り付け"

# モデル指定（推奨: gemini-2.0-flash または gemini-1.5-flash）
# ※省略時のデフォルトはコード上で `gemini-2.5-flash` となっていますが、
#   まだ存在しない可能性があるため明示的な指定を推奨します。
GEMINI_MODEL="gemini-2.0-flash"
```

### 動作確認

```bash
npm run dev:workers
```

上記コマンドでローカルサーバーを起動し、チャット機能が動作することを確認してください。

## 3. 本番環境 (Cloudflare Workers) の設定

本番環境に適用するには、環境変数を設定してデプロイする必要があります。

### 手順 A: コマンドラインで設定（推奨）

以下のコマンドをターミナルで実行して、APIキーを秘密情報として登録します。

```bash
npx wrangler secret put GEMINI_API_KEY
# 実行後、プロンプトが出るのでキーを貼り付けて Enter
```

次に、`wrangler.worker.toml` の `[vars]` セクションに以下を追記します（なければ作成）。

```toml
[vars]
AI_PROVIDER = "gemini"
GEMINI_MODEL = "gemini-2.0-flash"
```

その後、デプロイを実行します。

```bash
npm run deploy:workers
```

### 手順 B: Cloudflare Dashboard で設定

1. Cloudflare Dashboard にログインし、`Workers & Pages` > `voice-ky-v2` を開きます。
2. **Settings** > **Variables and Secrets** をクリックします。
3. **Add** をクリックして以下を追加します。
   - `GEMINI_API_KEY`: (取得したキー) ※ **Encrypt** ボタンを押して暗号化する
   - `AI_PROVIDER`: `gemini`
   - `GEMINI_MODEL`: `gemini-2.0-flash`
4. **Deploy** (または再デプロイ) して設定を反映させます。

## Q&A

**Q. OpenAIに戻したい場合は？**
A. `AI_PROVIDER="openai"` に変更するか、`AI_PROVIDER` の行を削除/コメントアウトすればデフォルトの OpenAI に戻ります。

**Q. どのモデルが良い？**

- `gemini-2.0-flash`: 最新で高速。性能も高い。（推奨）
- `gemini-1.5-flash`: 安定版。非常に高速で安価。
- `gemini-1.5-pro`: 高性能だが少し遅い。複雑な指示が必要な場合に。
