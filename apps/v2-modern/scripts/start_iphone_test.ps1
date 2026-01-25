
# iPhone実機テスト自動化スクリプト

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  iPhone実機テスト用サーバー起動ツール" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. ローカルIPアドレスの取得と表示
$ip = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias Wi-Fi,Ethernet* | Where-Object { $_.IPAddress -like '192.168*' -or $_.IPAddress -like '10.*' -or $_.IPAddress -like '172.*' } | Select-Object -First 1).IPAddress

if (-not $ip) {
    # フォールバック: 一般的なIP取得
    $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.PrefixOrigin -eq 'Dhcp' } | Select-Object -First 1).IPAddress
}

if ($ip) {
    Write-Host "`niPhoneのSafariで以下のURLにアクセスしてください:" -ForegroundColor Yellow
    Write-Host "  http://$($ip):5173" -ForegroundColor Green
    Write-Host "`n※注意: マイク許可が出ない場合は、Cloudflare Tunnelなどを検討してください。" -ForegroundColor Gray
} else {
    Write-Host "`n[警告] ローカルIPアドレスが見つかりませんでした。" -ForegroundColor Red
}

Write-Host "`nサーバーを起動しています... (Ctrl+C で停止)" -ForegroundColor White

# 2. バックエンド (Wrangler) をバックグラウンドで起動
# Start-Process を使用して別ウィンドウで立ち上げる（管理しやすいように）
# Write-Host "Starting Backend (Wrangler)..."
# $backendProcess = Start-Process -FilePath "npm" -ArgumentList "run", "dev:workers" -PassThru -NoNewWindow
# バックエンドはポート8787で待機

# 並列実行のために Start-Job や Start-Process を使う手法もあるが、
# ここでは簡易的にユーザーに指示を出すか、シンプルに npm-run-all 的なことをする。
# Windows PowerShellでは Start-Process が無難。

Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd '$PWD'; echo 'Backend (Wrangler) is running...'; npm run dev:workers"

# 3. フロントエンド (Vite --host) をこのウィンドウで起動
npm run dev:host
