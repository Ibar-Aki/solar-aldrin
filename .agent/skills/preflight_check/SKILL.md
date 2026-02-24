---
name: Pre-flight Check
description: テスト実行やデプロイ前に、APIや環境の健全性を確認するスキル。
---

# Pre-flight Check Skill

デプロイ、E2Eテスト、負荷テストなど「重い操作」の前に環境の健全性を確認するスキルです。
APIキー設定ミスやサーバーダウンによる「テスト全滅」を防ぐための最初の安全弁として使います。

---

## 実行内容

| チェック項目 | 内容 |
|------------|------|
| 1. APIサーバー健全性 | `/api/health` エンドポイントの応答確認 |
| 2. APIキー有効性 | 認証エラー（401/403）が出ないか |
| 3. AIプロバイダ疎通 | OpenAI / Gemini API への疎通確認 |
| 4. 環境変数の存在確認 | `.dev.vars` または `wrangler.toml` に必要なキーが揃っているか |

---

## 使用方法

### ローカル環境チェック

```powershell
./.agent/skills/preflight_check/check_status.ps1
```

または `apps/v2-modern` ディレクトリで:

```powershell
npm run test:cost:preflight
```

### 本番環境チェック

```powershell
./.agent/skills/preflight_check/check_status.ps1 -Target production
```

---

## 判定基準

| 結果 | 意味 | 次のアクション |
|------|------|---------------|
| ✅ ALL PASS | 全チェッククリア | デプロイ・テスト実行 OK |
| ⚠️ WARN | 一部機能が制限される可能性あり | 内容を確認し判断 |
| ❌ FAIL | 重大な問題あり | 下記エラー対応表を参照 |

---

## エラー対応

| エラー種別 | 原因 | 対処法 |
|-----------|------|--------|
| Auth Error (401/403) | APIキー未設定 or 無効 | `.dev.vars` の `OPENAI_API_KEY` / `GEMINI_API_KEY` / `API_TOKEN` を確認 |
| Connection Error | ローカルサーバー未起動 | `npm run dev:workers` でサーバーを起動してから再実行 |
| Missing Env Var | 環境変数が未定義 | `wrangler.toml` の `[vars]` セクション、または `.dev.vars` に追記 |
| Timeout | サーバー応答が遅すぎる | ネットワーク状態を確認、または `dev:workers` を再起動 |

---

## 必要な環境変数（最低限）

```
OPENAI_API_KEY   # または GEMINI_API_KEY
API_TOKEN        # フロントエンド ↔ Workers 間の認証トークン
```
