# Cloudflare Sentry設定手順（Workers / Pages）

- 作成日時: 2026-02-02 00:30
- 作成者: Codex + GPT-5
- 更新日: 2026-02-02
- 更新日: 2026-02-16（優先5テスト実行スクリプトとテスト用環境変数を追記）

---

## 目的

Workers（バックエンド）と Pages（フロント）で Sentry を動かすための
環境変数 / シークレット設定手順をまとめる。

---

## 事前に準備する値

**Workers（ランタイム）**
- `SENTRY_DSN`（Secret 推奨）
- `SENTRY_ENV`（例: `production` / `staging` / `local`）
- `SENTRY_RELEASE`（例: Git SHA / ビルド番号）

**Pages（ビルド時・フロント）**
- `VITE_SENTRY_DSN`（公開される値）
- `VITE_SENTRY_ENV`
- `VITE_SENTRY_RELEASE`

> `VITE_` で始まる環境変数はビルド後に公開されます。機密情報は置かないでください。

---

## 1. Workers（バックエンド）設定手順

### 1-1. CLI（Wrangler）で設定

**A. SENTRY_DSN を Secret として登録**
```
npx wrangler secret put SENTRY_DSN
```
- `wrangler secret put` は **即時デプロイ**を伴います。
- 秘密情報（DSN など）は `vars` ではなく Secret を推奨。

**B. SENTRY_ENV / SENTRY_RELEASE を `wrangler.toml` で設定**
```
# wrangler.toml
[vars]
SENTRY_ENV = "production"
SENTRY_RELEASE = "2026-02-02"
```

**C. 環境別に分けたい場合（staging など）**
```
# wrangler.toml
[env.staging.vars]
SENTRY_ENV = "staging"
SENTRY_RELEASE = "staging-2026-02-02"
```
```
npx wrangler deploy --env staging
```

**D. ローカル開発用（任意）**
- `.dev.vars` または `.env` に秘密情報を置く
- **どちらか一方のみ**使う

---

### 1-2. ダッシュボードで設定

1. Cloudflare ダッシュボード → **Workers & Pages**
2. 対象 Worker を選択
3. **Settings → Variables and Secrets → Add**
4. `SENTRY_DSN` は **Secret**、`SENTRY_ENV` / `SENTRY_RELEASE` は **Text**
5. **Deploy** で反映

---

## 2. Pages（フロント）設定手順

### 2-1. ダッシュボードで設定（本番 / プレビュー）

1. Cloudflare ダッシュボード → **Workers & Pages**
2. 対象 Pages プロジェクトを選択
3. **Settings → Environment variables**
4. **Production / Preview** 両方に追加
   - `VITE_SENTRY_DSN`
   - `VITE_SENTRY_ENV`
   - `VITE_SENTRY_RELEASE`
5. 保存後、再ビルド / 再デプロイ

> Pages Functions を使う場合は **Settings → Variables and Secrets** にも同様に設定する。

---

### 2-2. CLI（ローカル検証用）

ビルド時の Pages 環境変数はダッシュボード管理が基本です。
ローカルで Functions の動作を確認したい場合は以下のように指定できます。

```
npx wrangler pages dev --binding=VITE_SENTRY_DSN=... --binding=VITE_SENTRY_ENV=local --binding=VITE_SENTRY_RELEASE=local
```

---

## 3. Release 値の運用例（推奨）

- `SENTRY_RELEASE` / `VITE_SENTRY_RELEASE` は **Git SHA** または **ビルド番号**が推奨
- Pages には `CF_PAGES_COMMIT_SHA` が自動注入されるため、
  リリースIDの材料として利用可能

---

## 4. 確認チェック

- [ ] Workers に `SENTRY_DSN` / `SENTRY_ENV` / `SENTRY_RELEASE` が設定されている
- [ ] Pages に `VITE_SENTRY_*` が Production / Preview で設定されている
- [ ] Sentry 側で環境（env）・リリース（release）でフィルタできる

---

## 5. 優先5テスト（実運用）実行

### 5-1. テスト有効化（必要時のみ）

- Workers:
  - `ENABLE_SENTRY_TEST_ENDPOINT="1"`
  - `SENTRY_TRACES_SAMPLE_RATE`（分散トレース検証時は `0.1` 以上）
  - 任意: `SENTRY_TEST_TOKEN`（`x-sentry-test-token` ヘッダ保護）
- Pages:
  - `VITE_ENABLE_SENTRY_TEST_HOOK=1`
  - `VITE_SENTRY_TRACES_SAMPLE_RATE`（分散トレース検証時は `0.1` 以上）
  - 任意: `VITE_SENTRY_TRACE_PROPAGATION_TARGETS`

### 5-2. 実行コマンド

```bash
npm run test:sentry:priority5
```

### 5-3. 主な環境変数

- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG_SLUG`
- `SENTRY_PROJECT_SLUG`
- `SENTRY_TEST_APP_URL`（Pages URL）
- `SENTRY_TEST_API_URL`（Workers URL）
- 任意: `SENTRY_TEST_API_TOKEN` / `SENTRY_TEST_ENDPOINT_TOKEN`

