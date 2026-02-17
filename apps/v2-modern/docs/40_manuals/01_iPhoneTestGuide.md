# Voice KY Assistant - iPhoneテスト手順書

作成日時: 2026-02-18 00:41
作成者: Codex＋GPT-5
更新日: 2026-02-17（v2-modern 本番デプロイ手順と完全音声会話モード検証を反映）

このドキュメントは、`apps/v2-modern` を iPhone で検証するための最短手順を示します。

## 1. 推奨ルート（本番同等）

ローカルLANではなく、Cloudflare Pages にデプロイしたURLでの確認を推奨します。

### 1-1. PC側でデプロイ

```bash
cd apps/v2-modern
npm run deploy:workers
npm run deploy:pages
```

### 1-2. iPhone側でアクセス

- Safari で `https://voice-ky-v2.pages.dev` を開く
- 初回はマイク許可を「許可」
- 必要に応じて共有メニューから「ホーム画面に追加」

## 2. ローカルLANルート（必要時のみ）

同一Wi-Fiでの一時検証に限って利用します。

### 2-1. PC側起動

```bash
cd apps/v2-modern
npm run dev:host
npm run dev:workers
```

### 2-2. iPhone側アクセス

- PC のIPv4を確認（`ipconfig`）
- Safari で `http://<PCのIPv4>:5173` にアクセス
- HTTPではマイク権限挙動が不安定になることがあるため、最終確認は必ず本番URLで行う

## 3. テスト観点（iPhone）

- セッション開始ができる
- 音声入力（Mic）が開始/停止できる
- AI応答のTTS再生ができる
- 完全音声会話モードで、TTS終了後にマイクが自動再開する
- 完了画面まで進み、PDF表示/保存ができる

## 4. APIトークン運用の注意

- 既定運用では APIトークン設定なしで開始可能
- ただし `VITE_REQUIRE_API_TOKEN=1` または `REQUIRE_API_TOKEN=1` の環境ではトークン入力が必要
- `1 / true / yes / on` は有効値として扱う

## 5. トラブル時の切り分け

- 画面が古い:
  - Safari のサイトデータ削除後に再読み込み
- 音声入力できない:
  - Safari設定のマイク権限を再確認
- APIエラー:
  - `deploy:workers` の最新反映と APIキー設定を確認

## 6. テスト記録テンプレート

```text
【テスト日時】
【端末】iPhone / iOS
【URL】https://voice-ky-v2.pages.dev

【確認項目】
□ セッション開始
□ 音声入力
□ TTS再生
□ 完全音声会話（TTS後マイク自動再開）
□ PDF出力

【不具合・気づき】
```
