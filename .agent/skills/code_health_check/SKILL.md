---
name: Code Health Check
description: ファイルサイズ肥大化・型定義の重複・ドキュメントとコードの乖離を検出するスキル。
---

# Code Health Check Skill

コードベースの健全性を定期的にチェックするスキルです。
開発日誌で繰り返し発生した問題（巨大ファイル化・型定義の重複・ドキュメント乖離）を
早期に発見することを目的としています。

> このスキルは **大きなコード変更後** や **月1回の定期チェック** で使用してください。

---

## チェック内容

### 1. ファイルサイズ監視（500行超を検出）

```powershell
# apps/v2-modern 配下の TypeScript ファイルで500行超のものを一覧表示
Get-ChildItem -Path "apps/v2-modern/src","apps/v2-modern/workers" -Recurse -Include "*.ts","*.tsx" |
  Where-Object { (Get-Content $_.FullName | Measure-Object -Line).Lines -gt 500 } |
  Select-Object Name, @{N="Lines";E={(Get-Content $_.FullName | Measure-Object -Line).Lines}} |
  Sort-Object Lines -Descending
```

**判定基準:**

- ✅ 全ファイル500行以下 → 問題なし
- ⚠️ 500〜800行 → 分割を検討
- ❌ 800行超 → 分割を強く推奨（過去に `chat.ts` が1510行になったケースあり）

---

### 2. 型定義の重複チェック

```powershell
# workers/types.ts 以外で Bindings 型が定義されていないか確認
Select-String -Path "apps/v2-modern/workers/**/*.ts" -Pattern "type Bindings" |
  Where-Object { $_.Path -notmatch "types\.ts" }
```

**判定基準:**

- ✅ 結果なし → 一元化できている
- ❌ 結果あり → `workers/types.ts` に統合して重複を削除する

---

### 3. ドキュメント乖離チェック（手動確認ガイド）

`docs/00_overview/00_Master_Technical_Reference.md` で確認すべき項目:

| 確認項目 | 確認コマンド |
|---------|------------|
| コンポーネント数 | `Get-ChildItem apps/v2-modern/src/components -Include "*.tsx" -Recurse \| Measure-Object` |
| テスト数 | `Get-ChildItem apps/v2-modern/tests -Include "*.test.*" -Recurse \| Measure-Object` |
| workers/lib 構成 | `Get-ChildItem apps/v2-modern/workers/lib -Recurse` |
| AIデフォルトモデル | `Select-String "DEFAULT_MODEL\|gemini-\|gpt-" apps/v2-modern/workers/routes/*.ts` |

---

## 実行手順

1. PowerShell を開き、リポジトリルートに移動
2. 上記のチェック1〜3を順に実行
3. 問題があれば `docs/50_reviews/archive/YYYY-MM-DD_code_health.md` に記録

---

## 結果の記録テンプレート

```markdown
## YYYY-MM-DD Code Health Check

### 1. ファイルサイズ
- 最大ファイル: XXX.ts (NNN行)
- 500行超のファイル: N件

### 2. 型定義の重複
- 重複なし / 重複あり（ファイル名）

### 3. ドキュメント乖離
- コンポーネント数: ドキュメント=N, 実際=N → 差分=N
- テスト数: ドキュメント=N, 実際=N → 差分=N

### 総合評価: ✅ / ⚠️ / ❌
```
