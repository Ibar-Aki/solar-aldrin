---
name: Codex Performance Review
description: CodeXを使ってパフォーマンスレビューを実行します（別ウィンドウで起動）
---

# Codex Performance Review

Codexを別ウィンドウで起動し、パフォーマンスレビュープロンプトを自動コピーします。
ユーザーの操作を最小限にするための自動化スクリプトを実行します。

## 実行手順

以下のコマンドを実行してください。

```powershell
powershell -ExecutionPolicy Bypass -File "c:\Users\AKIHIRO\.gemini\antigravity\playground\solar-aldrin\.agent\skills\codex_performance_review\run.ps1"
```

## 自動処理の内容

1. レビュー指示（プロンプト）をクリップボードに自動コピーします。
2. Codexを新しいウィンドウで起動します。

## ユーザー操作

ウィンドウが開いたら、**Ctrl+V** を押して **Enter** を押すだけでレビューが開始されます。
