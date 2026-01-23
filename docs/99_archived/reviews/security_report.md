# セキュリティチェックレポート

- 対象: C:\Users\AKIHIRO\.gemini\antigravity\playground\solar-aldrin
- 作成日: 2026-01-23
- 目的: push 前の簡易セキュリティ確認（モックアップ）
- 方法: リポジトリ内の静的スキャン（キーワード検索/設定確認）

## サマリー

- 重大: 1件
- 高: 2件
- 中: 1件
- 低: 2件

## 指摘事項

### 重大

1) OpenAI APIキーの実値が平文で存在  
   - 位置: `apps/v1-legacy/src/workers/.dev.vars` (※削除・対応済み)  
   - 影響: push/公開で即漏えい。第三者による不正利用の恐れ。  
   - 推奨: ファイル削除 + キーローテーション。履歴に入っていれば履歴から除去。

### 高

2) 認証なし + CORS `*` で全API公開  
   - 位置: `apps/v1-legacy/src/workers/index.js`（CORS設定と /api/* ルーティング）  
   - 影響: 第三者がAPIを自由に呼び出せる。コスト増/悪用リスク。  
   - 推奨: 最低限の認証（固定トークン/CF Access 等）とOrigin制限を導入。

2) 記録APIが無認証でデータ保存/取得  
   - 位置: `apps/v1-legacy/src/workers/index.js`（/api/records の POST/GET）  
   - 影響: Supabaseキーが設定された場合にデータ漏えい/改ざんの恐れ。  
   - 推奨: 認証必須化、RLS/権限設計の確認（特にサービスロールキーは厳禁）。

### 中

4) `.wrangler` 生成物が追跡対象になり得る  
   - 位置: `src/workers/.wrangler/`  
   - 影響: ローカルパス/内部情報の混入、サイズ肥大。  
   - 推奨: `.gitignore` に追加。

### 低

5) CDNスクリプトにSRIなし  
   - 位置: `apps/v1-legacy/src/public/qr.html`、`apps/v1-legacy/src/public/js/screens/done.js`  
   - 影響: 供給元改ざん時の影響を受けやすい。  
   - 推奨: SRI付与、またはローカル同梱。

2) エラー詳細の外部露出  
   - 位置: `apps/v1-legacy/src/workers/index.js`（例外の `error.message` を返却）  
   - 影響: 内部情報が外部へ露出する可能性。  
   - 推奨: 返却は汎用メッセージに留め、詳細はログのみ。

## 追加メモ

- 重大/高の対応が完了するまでは public リポジトリへの push は非推奨。  
- 本チェックは静的確認のみ。実運用予定が出た時点で再評価推奨。

## push 前チェックリスト（簡易）

- [ ] `src/workers/.dev.vars` を削除し、キーをローテーション済み  
- [ ] `.gitignore` に `src/workers/.wrangler/` などを追加済み  
- [ ] APIに認証とCORS制限を適用済み  
