# レポジトリ徹底レビュー（再確認・修正後）

- 対象: `solar-aldrin`
- 実施日: 2026-01-23
- 目的: 指摘事項の是正状況の確認

## 修正済み

1) フロントのハードコード認証キー削除  
   - 変更: `X-Custom-Auth` を送らない  
   - 位置: `apps/v1-legacy/src/public/js/api.js`

2) CORS判定を厳格化  
   - 変更: `includes()` を廃止し、ホワイトリスト + localhost正規表現に限定  
   - 位置: `apps/v1-legacy/src/workers/index.js`

3) クライアント提供履歴の無害化  
   - 変更: role制限 / 件数制限 / 文字数制限  
   - 位置: `apps/v1-legacy/src/workers/index.js`

4) 会話データの上書きルールを明確化  
   - 変更: `hazards` / `countermeasures` は配列なら空でも上書き  
   - 位置: `apps/v1-legacy/src/public/js/screens/chat.js`

5) DB初期化失敗時のガード追加  
   - 変更: `Storage.isReady` を導入し、未初期化時はエラーで停止  
   - 位置: `apps/v1-legacy/src/public/js/storage.js`

6) DBエラー詳細の露出を抑制  
   - 変更: `details` や `e.message` を返さず固定文言  
   - 位置: `apps/v1-legacy/src/workers/index.js`

7) .dev.vars の実キー削除  
   - 変更: プレースホルダへ差し替え  
   - 位置: `src/workers/.dev.vars`

## 依然として残る課題 (※2026-01-24 一部対応済み)

1) 認証は「CORS + Origin制限」のみ  
   - 非ブラウザ（curl等）による直叩きは抑制されるが、厳密な認証ではない。  
   - 必要に応じて Cloudflare Access / JWT / APIキー配布方式の導入を検討。

2) LLM入力の「役割・安全性」全体の設計  
   - system/role注入は抑止済みだが、ユーザー入力の長文化・悪用は依然可能。  
   - サーバー側で文字数上限や禁止語処理の追加を検討。

## 推奨次ステップ

- 本番運用する場合は、Access/JWT などの強固な認証方式へ移行。  
- `.dev.vars` の実キーはローカルのみで管理し、push前に再確認。  
