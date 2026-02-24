---
name: Codex Performance Review
description: CodeXを使ってパフォーマンスレビューを実行します（別ウィンドウで起動）
---

# Codex Performance Review Skill

Codex CLI を使ってパフォーマンス視点のコードレビューを実行するスキルです。
メモリリーク、N+1クエリ、非効率なアルゴリズム、不要なAPIコールなどを検出します。

---

## レビュー観点

| カテゴリ | 具体的な検出内容 |
|---------|----------------|
| メモリ | Mapキャッシュのサイズ制限なし / revokeObjectURL モレ / 巨大配列の全件保持 |
| API呼び出し | N+1パターン / 不要なリトライ / タイムアウト設定漏れ |
| コードサイズ | 500行超の巨大ファイル（分割候補）/ コピペ重複コード |
| 非同期 | await 忘れ / Promiseチェーンの誤り / rAFキャンセル漏れ |

---

## 実行方法

### 1. スクリプトで起動（推奨）

```powershell
powershell -ExecutionPolicy Bypass -File "c:\Users\AKIHIRO\.gemini\antigravity\playground\solar-aldrin\.agent\skills\codex_performance_review\run.ps1"
```

ウィンドウが開いたら **Ctrl+V** → **Enter** でレビューが開始されます。

### 2. 手動で Codex を使う場合

```powershell
# 未コミット変更のみレビュー
codex review --uncommitted

# 特定ブランチとの差分をレビュー
codex review --base main
```

---

## レビュー結果の保存

結果を記録として残す場合は、`docs/50_reviews/` に保存してください:

```
apps/v2-modern/docs/50_reviews/
└── archive/
    └── YYYY-MM-DD_performance_review.md
```

---

## 自動処理の内容

1. レビュー指示（パフォーマンス観点プロンプト）をクリップボードに自動コピー
2. Codex を新しいウィンドウで起動

---

## 過去レビューとの比較

前回のレビュー結果と比べて改善されているか確認する場合:

```powershell
# 前回のレビュー結果を参照
Get-Content "apps/v2-modern/docs/50_reviews/archive/*performance_review*" | Select-Object -Last 50
```
