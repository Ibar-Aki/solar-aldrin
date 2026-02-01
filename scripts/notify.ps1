param(
    [string]$Title = "Antigravity Task",
    [string]$Message = "処理が完了しました。"
)

try {
    # Windows Runtime API 用のアセンブリをロード (明示的ロードは不要な場合が多いが念のため)
    # [System.Runtime.InteropServices.WindowsRuntime]::LoadRestrictedType -> PowerShell Core等では非推奨・不要な場合も

    $template = @"
<toast>
    <visual>
        <binding template="ToastGeneric">
            <text>$Title</text>
            <text>$Message</text>
        </binding>
    </visual>
    <audio src="ms-winsoundevent:Notification.Default" />
</toast>
"@

    $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
    $xml.LoadXml($template)

    $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
    $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Antigravity Agent")
    $notifier.Show($toast)
    
    Write-Host "通知を送信しました: $Title - $Message" -ForegroundColor Green
} catch {
    Write-Error "通知の送信に失敗しました: $_"
}
