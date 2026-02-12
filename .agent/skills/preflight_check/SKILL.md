---
name: Pre-flight Check
description: テスト実行やデプロイ前に、APIや環境の健全性を確認するスキル。
---

# Pre-flight Check Skill

このスキルは、E2Eテストや負荷テスト、デプロイなどの「重い操作」を行う前に、環境が正常であることを確認するために使用します。
特に、APIキーの設定ミスやサーバーダウンによる「テスト全滅」を防ぐために必須です。

## 実行内容

1. **APIサーバーの健全性確認 (`/api/health`)**
2. **APIキーの有効性確認** (Authエラーが出ないか)
3. **サーバーポリシーの確認** (バージョン不整合がないか)

## 使用方法

以下のコマンドを実行してチェックを行います。

```powershell
./.agent/skills/preflight_check/check_status.ps1
```

または、`apps/v2-modern` ディレクトリで直接以下を実行することも可能です。

```powershell
npm run test:cost:preflight
```

## エラー時の対応

* **Auth Error**: `.dev.vars` または `wrangler.toml` の `API_TOKEN` / `OPENAI_API_KEY` を確認してください。
* **Connection Error**: ローカルサーバー (`npm run dev:workers`) が起動しているか確認してください。
