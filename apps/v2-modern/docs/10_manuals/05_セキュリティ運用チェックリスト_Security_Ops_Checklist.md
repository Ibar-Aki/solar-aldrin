# セキュリティ運用チェックリスト（実行手順書）

- 作成日時: 2026-02-06 21:54:36 +09:00
- 作成者: Codex＋GPT-5
- 更新日: 2026-02-06（実費テスト preflight/運用コマンドを追記）
- 対象: `apps/v2-modern`

## 0. 最初にあなたがやること（本日中）

1. 露出した `OPENAI_API_KEY` を失効し、新しいキーを発行する。
2. 本番に `API_TOKEN` を設定し、`REQUIRE_API_TOKEN=1` を有効化する。
3. 本番に `REQUIRE_RATE_LIMIT_KV=1` を設定し、`RATE_LIMIT_KV` バインディングを確認する。
4. 本番に `STRICT_CORS=1` と `ALLOWED_ORIGINS` を設定する。
5. 動作確認で `health=ok`、未認証 `401`、不正Origin `403` を確認する。

## 0.5 最小作業モード（推奨）

1. `wrangler` にログインする（初回のみ）。
```bash
cd apps/v2-modern
npx wrangler login
```
2. 一括運用コマンドを実行する。
```bash
npm run security:ops -- -AllowedOrigins "https://v2.voice-ky-assistant.pages.dev,https://<your-domain>" -BaseUrl "https://<your-worker-or-pages-domain>"
```
- 実行内容:
- `API_TOKEN` 生成と設定
- `REQUIRE_API_TOKEN=1` / `REQUIRE_RATE_LIMIT_KV=1` / `STRICT_CORS=1` / `ALLOWED_ORIGINS` 設定
- `lint/test/build/audit` 実行
- Pages デプロイ
- `health` / `401` / `200` / `403` のスモークテスト
3. OpenAIキーを更新する場合は、コマンド実行中のプロンプトで入力する（空Enterなら既存値維持）。
4. オプション:
- `-SkipOpenAiKeyUpdate`: キー入力プロンプトを出さない。
- `-SkipDeploy`: secret反映とローカル検証のみ実施し、デプロイを行わない。

## 1. 事前確認

1. 対象ブランチに以下変更が含まれていることを確認する。
- `workers/index.ts`
- `workers/middleware/rateLimit.ts`
- `workers/routes/chat.ts`
- `workers/observability/logger.ts`
- `workers/routes/metrics.ts`
- `workers/lib/openai.ts`
- `workers/lib/securityMode.ts`
2. 依存が更新済みであることを確認する。
- `hono@4.11.8` 以上

## 2. 緊急対応（キー失効・再発行）

1. OpenAI Platform で新しい API キーを作成する。
2. 新しいキーを本番へ反映する。
```bash
cd apps/v2-modern
npx wrangler secret put OPENAI_API_KEY
```
3. 旧キーを OpenAI Platform で失効する。
4. ローカル開発環境の `.dev.vars` も新しいキーに差し替える。
5. 失効・再発行の実施日時を運用記録に残す。

## 3. 本番セキュリティ設定反映

### 3.1 認証必須化

1. 強固な `API_TOKEN` を発行する。
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
2. 本番に `API_TOKEN` を設定する。
```bash
npx wrangler secret put API_TOKEN
```
3. 本番に `REQUIRE_API_TOKEN=1` を設定する。
- Cloudflare Dashboard の環境変数、または `wrangler.toml` の本番環境設定で反映する。

### 3.2 レート制限フェイルクローズ

1. 本番に `REQUIRE_RATE_LIMIT_KV=1` を設定する。
2. `RATE_LIMIT_KV` バインディングが本番に存在することを確認する。
- 未設定の場合、API は `503` で応答する。

### 3.3 CORS 厳格化

1. 本番に `STRICT_CORS=1` を設定する。
2. 本番に `ALLOWED_ORIGINS` をカンマ区切りで設定する。
- 例: `https://v2.voice-ky-assistant.pages.dev,https://your-domain.example`
3. 不要な開発用ドメイン許可を本番に残さない。

## 4. デプロイ

1. ビルドとテストを実行する。
```bash
npm run lint
npm run test
npm run build
```
2. Workers をデプロイする。
```bash
npm run deploy:pages
```

## 5. デプロイ後の動作確認

1. ヘルスチェックが正常であることを確認する。
```bash
curl.exe -i "https://<your-worker-or-pages-domain>/api/health"
```
- 期待値: `200` + `{"status":"ok","version":"v2"}`

2. 未認証アクセスが拒否されることを確認する。
```bash
curl.exe -i "https://<your-worker-or-pages-domain>/api/metrics" ^
  -H "Content-Type: application/json" ^
  -d "{\"event\":\"session_start\"}"
```
- 期待値: `401`

3. 認証付きアクセスが通ることを確認する。
```bash
curl.exe -i "https://<your-worker-or-pages-domain>/api/metrics" ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer <API_TOKEN>" ^
  -d "{\"event\":\"session_start\"}"
```
- 期待値: `200`

4. 不正Originが拒否されることを確認する。
```bash
curl.exe -i "https://<your-worker-or-pages-domain>/api/metrics" ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer <API_TOKEN>" ^
  -H "Origin: https://evil.example.com" ^
  -d "{\"event\":\"session_start\"}"
```
- 期待値: `403`

## 6. 定期運用チェック（継続）

### 毎日

1. `401/403/429/503` の急増がないかログを確認する。
2. OpenAI API エラー率の急増がないか確認する。

### 毎週

1. `ALLOWED_ORIGINS` の棚卸しを行う。
2. `REQUIRE_API_TOKEN` / `REQUIRE_RATE_LIMIT_KV` / `STRICT_CORS` が意図通り `1` であることを確認する。

### 毎月

1. `OPENAI_API_KEY` と `API_TOKEN` のローテーション計画を更新する。
2. `npm audit --omit=dev` を実行し脆弱性を確認する。

## 9. 実費テスト運用（本番直結）

1. 実費テスト前に環境変数を設定する。
```bash
set LIVE_BASE_URL=https://v2.voice-ky-assistant.pages.dev
set VITE_API_TOKEN=<API_TOKEN>
```
2. 事前疎通チェックを実行する。
```bash
npm run test:cost:preflight
```
3. 本番直結の Mobile Safari 実費E2E を実行する。
```bash
npm run test:cost:live
```
4. 上記を一括で行う場合は次を実行する。
```bash
npm run test:cost:ops
```
5. 履歴整理が必要な場合、日付ごと最新1件のみ残して圧縮する。
```bash
npm run reports:prune
```
6. 性能推移を再集計する。
```bash
npm run reports:perf
```

## 7. インシデント時の初動

1. キー漏えいが疑われる場合は、まずキー失効と再発行を実施する。
2. `REQUIRE_API_TOKEN=1` を再確認し、無効なら即時有効化する。
3. 不審Originがある場合は `ALLOWED_ORIGINS` を最小化する。
4. 影響範囲と実施時刻を運用記録に残す。

## 8. 補足（現行方式の注意）

1. 現行は共有トークン方式のため、将来的には IDaaS/JWT 方式へ移行すること。
2. `VITE_API_TOKEN` を配布物に含める運用は、恒久対策ではなく暫定対策として扱うこと。
