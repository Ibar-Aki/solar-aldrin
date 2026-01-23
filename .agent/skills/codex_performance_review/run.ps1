
# プロンプト定義
$prompt = "src/public/js/ と src/workers/index.js のコードをレビューし、パフォーマンス問題を検出してください。`n以下の観点でチェックし、日本語で報告してください：`n- N+1クエリ`n- メモリリーク・非効率なメモリ使用`n- 不要なループ・冗長な処理`n- キャッシュ導入の機会`n- アルゴリズムの効率性"

# クリップボードにコピー
Set-Clipboard -Value $prompt
Write-Host "✅ レビュー指示をクリップボードにコピーしました"

# Codexを起動
Write-Host "🚀 Codexを起動しています..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "codex"

# 案内表示
Write-Host "--------------------------------------------------------"
Write-Host "【手順】"
Write-Host "1. 新しく開いたウィンドウをクリックしてアクティブにする"
Write-Host "2. Ctrl+V を押して貼り付ける"
Write-Host "3. Enter を押して実行する"
Write-Host "--------------------------------------------------------"
