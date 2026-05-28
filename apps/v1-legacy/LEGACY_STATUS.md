# v1-legacy Legacy Status

作成日: 2026-05-28 01:11 JST
作成者: Codex (GPT-5)

## 位置づけ

`apps/v1-legacy` は Phase 1 の実現可能性検証アーカイブです。現在の配布・運用・改修対象は `apps/v2-modern` です。

## 運用ルール

- v1 は新規デプロイしません。
- v1 の `deploy:workers` / `deploy:pages` は誤公開防止のため失敗する設定です。
- 既存コードは、仕様比較、過去判断の確認、必要時の部品参照に限って利用します。
- v1 側に秘密情報や本番設定を追加しません。
- 友人や現場利用者へ共有するURLは v2 の Pages URL を使います。

## 復元が必要な場合

v1 の再公開が必要になった場合は、先に `apps/v1-legacy/src/workers/index.js` の認証・CORS・記録APIを再レビューし、公開可否を明示判断してから deploy script を戻します。
