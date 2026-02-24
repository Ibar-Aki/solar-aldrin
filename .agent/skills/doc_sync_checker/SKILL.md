---
name: Doc Sync Checker
description: docs/のドキュメントとコードベースの乖離を検出するスキル。00_Master_Technical_Reference.mdを主な対象とします。
---

# Doc Sync Checker Skill

ドキュメントとコードの乖離を検出するスキルです。
`00_Master_Technical_Reference.md` を中心に、記載内容が実際のコードベースと一致しているか確認します。

> **使用タイミング**: 大きなリファクタリング後 / コンポーネントの追加・削除後 / Phase完了時

---

## チェック対象ドキュメント

- `apps/v2-modern/docs/00_overview/00_Master_Technical_Reference.md`（主要）
- `apps/v2-modern/docs/20_phases/Phase2_Completion_Report.md`
- `apps/v2-modern/docs/30_design/01_SystemArchitecture.md`

---

## チェック手順

### ステップ 1: コンポーネント数の確認

```powershell
# 実際のコンポーネント数
$actual = (Get-ChildItem "apps/v2-modern/src/components" -Include "*.tsx" -Recurse).Count
Write-Host "実際のコンポーネント数: $actual"

# ドキュメントに記載された数を確認（目視）
# Select-String "コンポーネント" apps/v2-modern/docs/00_overview/00_Master_Technical_Reference.md
```

### ステップ 2: テスト数の確認

```powershell
# 実際のテストファイル数
$tests = (Get-ChildItem "apps/v2-modern/tests" -Include "*.test.*" -Recurse).Count
Write-Host "実際のテストファイル数: $tests"
```

### ステップ 3: Workers/lib 構成の確認

```powershell
# 実際の workers/lib 構成
Get-ChildItem "apps/v2-modern/workers/lib" -Recurse | Select-Object Name, @{N="Type";E={if($_.PSIsContainer){"Dir"}else{"File"}}}
```

### ステップ 4: AIモデル名の確認

```powershell
# デフォルトモデル名を全ファイルから抽出
Select-String "gemini-|gpt-4o" apps/v2-modern/workers/routes/*.ts |
  Where-Object { $_.Line -match "DEFAULT|fallback|=\s*['\`"]" }
```

### ステップ 5: 環境変数一覧の確認

```powershell
# wrangler.toml に定義されている環境変数
Select-String "^\[vars\]" apps/v2-modern/wrangler.toml -A 20
```

---

## 乖離の記録と更新方法

乖離が見つかった場合は **「コードが正」** の方針でドキュメントを更新する。

```markdown
## 更新チェックリスト

- [ ] コンポーネント数: N → N に更新
- [ ] テスト数: N → N に更新
- [ ] workers/lib 構成: 追加/削除ファイルを反映
- [ ] AIデフォルトモデル: XXX → XXX に更新
- [ ] 環境変数一覧: 追加/削除された変数を反映
```

---

## 参考: 過去の乖離事例（日誌より）

| 発生時期 | 乖離内容 | 教訓 |
|---------|---------|------|
| 2026-02-09 | Phase 2.4/2.5 が「実装済」になっていたが未実装だった | コードを正として即時修正すると混乱を防げる |
| 2026-02-13 | chat.ts のデフォルトモデルが古い値で記録されていた | 実装後に日誌・ドキュメント両方を即時更新する |
| 2026-02-21 | コンポーネント数 11→13、テスト数 21→55 の乖離 | 大きなリファクタリング後は必ず同期する |
