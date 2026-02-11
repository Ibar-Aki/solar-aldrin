# 運用ガイド (Operations Guide)

本ドキュメントは、Voice KY Assistant v2 の運用・保守に関する手順をまとめたものです。

更新日: 2026-02-07
更新日: 2026-02-11（APIトークン認証の既定運用を更新）
更新日: 2026-02-11（認証フラグ解釈と任意モードのBearer挙動を明記）

---

## 🔑 APIキー管理 (Key Management)

### OpenAI APIキーのローテーション手順

セキュリティリスク低減のため、定期的なキーのローテーション（交換）を推奨します。

1. **新しいキーの発行**:
    * OpenAI Platform の [API Keys](https://platform.openai.com/api-keys) ページにアクセス。
    * "Create new secret key" をクリックし、新キーを発行します。

2. **Workersへの反映**:
    * 以下のコマンドで、本番環境の環境変数を更新します。

    ```bash
    cd apps/v2-modern
    npx wrangler secret put OPENAI_API_KEY
    # プロンプトが表示されたら、新しいキーを入力
    ```

3. **動作確認**:
    * アプリでチャットを行い、正常に応答することを確認。

4. **古いキーの無効化**:
    * OpenAI Platform 上で、古いキーを削除 (Delete) します。

---

## 🛡️ セキュリティ設定 (Security Settings)

### APIトークン認証の運用方針

* **既定（推奨）**: `REQUIRE_API_TOKEN=0`（APIトークン認証を必須化しない）
  * iPhoneや共有リンクで初回アクセスした利用者でも、設定なしで利用開始できます。
* **必須化したい場合のみ**:
  * Workers: `REQUIRE_API_TOKEN=1` と `API_TOKEN=<secret>` を設定
  * Frontend: `VITE_REQUIRE_API_TOKEN=1` を設定（ホーム画面にAPIトークン入力欄を表示）
* **フラグ解釈**:
  * `1 / true / yes / on` は有効、`0 / false / no / off` は無効として解釈されます（Frontend/Workers共通）。
* **認証任意モードの挙動**:
  * `REQUIRE_API_TOKEN=0` のときは、`Authorization: Bearer ...` が付与されていても認証チェックをスキップします。

### レート制限 (Rate Limiting)

* **現状設定**: 1分あたり **30リクエスト** / IP
* **ファイル**: `workers/index.ts`
* **変更方法**:

    ```typescript
    app.use('/api/*', rateLimit({ maxRequests: 50, windowMs: 60000 })) // 50回に変更する場合
    ```

### Origin制限 (CORS)

* **許可リスト**:
  * `DEFAULT_ALLOWED_ORIGINS` (コード内定義: localhost, *.pages.dev)
  * 環境変数 `ALLOWED_ORIGINS`
* **環境変数での追加**:
  * `wrangler.toml` またはダッシュボードで `ALLOWED_ORIGINS` を設定（カンマ区切り）。
  * 例: `https://my-custom-domain.com,https://partner-site.com`

---

## 🚨 トラブルシューティング

### "429 Too Many Requests" が頻発する場合

* **原因**: 特定のIPからのアクセスがレート制限を超えています。
* **対応**:
    1. DDoS攻撃でないか確認（Cloudflareダッシュボード）。
    2. 正規の利用であれば、`workers/index.ts` の `maxRequests` を緩和してデプロイ。

### "403 Forbidden" (CORS Error)

* **原因**: 未許可のドメインからAPIを呼び出そうとしています。
* **対応**:
    1. ブラウザコンソールで `Origin` を確認。
    2. 正規ドメインであれば、`ALLOWED_ORIGINS` 環境変数に追加。
