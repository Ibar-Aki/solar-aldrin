# Codex Performance Review Skill
# Encoding: UTF-8 with BOM

# プロンプト定義
$prompt = @"
src/ と workers/ 配下のコードをレビューし、パフォーマンス問題を検出してください。
以下の観点でチェックし、日本語で報告してください：
- N+1クエリ
- メモリリーク・非効率なメモリ使用
- 不要なループ・冗長な処理
- キャッシュ導入の機会
- アルゴリズムの効率性
"@

# クリップボードにコピー
Set-Clipboard -Value $prompt
Write-Host "レビュー指示をクリップボードにコピーしました" -ForegroundColor Green

# Codexを起動
Write-Host "Codexを起動しています..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "codex"

# 案内表示
Write-Host "--------------------------------------------------------"
Write-Host "[手順]"
Write-Host "1. 新しく開いたウィンドウをクリックしてアクティブにする"
Write-Host "2. Ctrl+V を押して貼り付ける"
Write-Host "3. Enter を押して実行する"
Write-Host "--------------------------------------------------------"
