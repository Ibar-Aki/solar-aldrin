# リファクタリング徹底レビュー（Phase2x 構造整理）

- 実施日: 2026-01-28
- 対象ブランチ: refactor/phase2x-structure
- レビュー範囲: `apps/v2-modern/*`, `docs/*` の差分
- テスト実行: 未実行（レビュー時点）

## 概要（結論）

現状のリファクタリングは概ね目的に沿っていますが、**データ抽出フローの整合性**と**完了判定の条件**に機能欠落リスクがあり、最優先で修正が必要です。加えて、**型/スキーマの不整合**や**永続化キー変更**の影響が大きいため、意図の確認と対策が求められます。

## 重大度定義

- 重大: ユーザー体験やデータ保存に直接影響しうる欠陥
- 重要: 仕様不整合・回帰・運用影響が高い
- 中: 品質/保守性/検証性に影響
- 低: ノイズや軽微な不具合の可能性

## 指摘事項（優先度順）

| 重要度 | 指摘 | 影響 | 対象 | 対応要否 (Action Required) |
|---|---|---|---|---|
| 重大 | `nextAction` が `confirm`/`completed` の場合に `commitWorkItem` が走らず、**最終作業が保存されない可能性** | 完了時のデータ欠損 | `apps/v2-modern/src/hooks/useChat.ts:70-73` | **Yes** (Check logic) |
| 重要 | `whyDangerous` / `countermeasures` を**上書き**しており、AIが差分のみ返す場合に過去分が消える | データ消失・会話の整合性欠落 | `apps/v2-modern/src/hooks/useChat.ts:61-67` | **Yes** (Implement merge) |
| 中 | `ChatResponseSchema` が `extracted` を未定義のまま、`any` キャストで回避している | API契約が型で守られない | `apps/v2-modern/src/lib/schema.ts:48-56` / `apps/v2-modern/src/hooks/useChat.ts:91-93` | **Yes** (Update Schema) |
| 中 | `ExtractedDataSchema` が旧仕様（`workItem`/`isComplete`）のまま | 解析/バリデーションが実態と不整合 | `apps/v2-modern/src/lib/validation.ts:16-31` | **Yes** (Update Schema) |
| 中 | 永続化キー変更により**既存セッションが消える** | 既存ユーザーのデータ喪失 | `apps/v2-modern/src/stores/kyStore.ts:20` | No (Intentional for Dev) |
| 低 | 抽出データの `console.log` が本番で情報露出/ノイズになる可能性 | 監視ノイズ・情報露出 | `apps/v2-modern/src/hooks/useChat.ts:53` | **Yes** (Remove/Debug only) |
| 低 | ドキュメント/画像アセットの大量削除 | 参照切れ・説明欠落の可能性 | `docs/assets/*` 等の削除差分 | No (Cleanup) |

## 改善提案（要約）

1. **完了判定の条件を見直し**  
   - `nextAction === 'confirm' || 'completed'` の場合も `commitWorkItem` を実行するか、  
   - もしくは `isWorkItemComplete()` 判定で保存可否を決める方式へ寄せる。
2. **リスト項目はマージ方式に戻す**  
   - `whyDangerous` / `countermeasures` は既存配列と結合して重複排除する。  
   - あるいはプロンプト側で「必ず全量を返す」を強制し、その前提を明記。
3. **APIスキーマ更新**  
   - `ChatResponseSchema` に `extracted` を追加し、`any` を削除。  
   - `ExtractedDataSchema` を新仕様（flattened）に更新。
4. **永続化キーの影響確認**  
   - 変更が意図的か確認。意図的なら、移行/リセット手順の明記が必要。
5. **ログ出力の制御**  
   - 本番ビルド時は無効化する、またはデバッグフラグで切り替える。

## 確認事項（回答待ち）

- `/api/chat/extract` は完全廃止で問題ないか（`schema.ts` に残っているため）
- AIが `whyDangerous` / `countermeasures` を常に**全量**で返す前提で良いか
- 永続化キー変更で既存データが消えることを許容するか
- 削除された `docs/assets/*` は意図的か（参照切れがないか）

## テスト状況

- 実行: 未実行  
- 推奨: 最低限 `apps/v2-modern/tests/kyStore.test.ts` と `apps/v2-modern/tests/integration.test.ts` の再実行

## 次のアクション案

1. 上記「確認事項」に回答をもらい、優先度の高い修正から適用
2. 型/スキーマ整合を回復後にテスト実行
