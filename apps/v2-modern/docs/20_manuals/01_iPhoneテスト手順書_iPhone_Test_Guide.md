# 📱 Voice KY Assistant - iPhoneテスト手順書

更新日: 2026-02-07

## 🎯 概要

このドキュメントは、**Voice KY Assistant** をiPhoneでテストするための手順を説明します。
**検証の結果、PCへの直接接続（LAN経由）が最も安定して動作することが確認されました。**

---

## 📋 テスト前の準備（PC側）

### 1. 開発サーバー起動

```bash
# フロントエンド (ポート3000)
npx serve apps/v1-legacy/src/public -l 3000 --cors

# バックエンド (ポート8787)
cd apps/v1-legacy/src/workers
npx wrangler dev --port 8787
```

### 2. ファイアウォール設定（初回のみ）

PowerShell（管理者）で以下を実行して、ポート3000への外部アクセスを許可します。

```powershell
netsh advfirewall firewall add rule name="Voice KY" dir=in action=allow protocol=tcp localport=3000
```

### 3. IPアドレス確認

```powershell
ipconfig
# IPv4 アドレスを確認 (例: 192.168.3.10)
```

---

## 📱 iPhoneでのアクセス手順

### Step 1: Wi-Fi接続確認

iPhoneがPCと同じWi-Fiネットワークに接続されていることを確認してください。

### Step 2: Safariでアクセス

以下の形式でURLを入力します：
`http://[PCのIPアドレス]:3000`

例:

```
http://192.168.3.10:3000
```

### Step 3: ホーム画面に追加（PWAインストール）

1. Safariの**共有ボタン**（□↑）をタップ
2. 下にスクロールして **「ホーム画面に追加」** をタップ
3. アイコンがホーム画面に追加されます

---

## ⚠️ 注意点

- **音声認識エラー表示**
  - 音声認識エラーが表示されても、入力欄に1文字入力すればエラー表示は消えます。

- **Service Workerのキャッシュ**
  - アプリの更新が反映されない場合、iPhoneの「設定 > Safari > 履歴とWebサイトデータを消去」を行ってください。
  - または、プライベートブラウズモードを使用してください。

- **HTTPSではないため**
  - 現在の手順（http）では、マイク権限の挙動がhttps環境と異なる場合があります。
  - 基本的な動作確認には十分ですが、本番相当のテストはCloudflare Pagesへのデプロイを推奨します。

---

## 📝 テスト報告用メモ

```
【テスト日時】
【テスト端末】iPhone ○○ / iOS ○○
【テスト環境】ローカルLAN接続 (IP: ____________)

【確認項目】
☐ 画面が表示される
☐ 対話が開始できる
☐ PDFが生成される

【問題点・気付き】

```
