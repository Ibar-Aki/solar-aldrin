# ドキュメント再編 完全移行プラン

作成日: 2026-01-28

## 0. 先に結論（フェーズ切り分け）
- **Phase 1**: 既存MVP/legacy（v1）関連は `70_reviews/phase1` と `99_archived/phase1` に集約。
- **Phase 2**: v2-modern/Phase2.x は `10_planning/phase2`・`20_requirements`・`30_design`・`40_testing/phase2.x` に配置。
- **共通**: リポジトリ全体の説明・運用ガイドは `00_overview` と `50_manuals` に配置。
- 各md先頭に **対象フェーズ** を明記する（例: `対象フェーズ: Phase 2`）。

## 1. 目的
- 探しやすさ（ライフサイクル順）と、Phase1/Phase2の判別性を最大化する。
- ドキュメントの役割と位置を一目で判断できるようにする。

## 2. 新フォルダ構成（推奨）
```
docs/
00_overview/        # 概要・全体説明・プレゼン
10_planning/        # 計画・ロードマップ・意思決定
  phase2/
    decisions/
20_requirements/    # 要件定義
30_design/          # 設計/仕様/アーキテクチャ
40_testing/         # テスト計画/結果
50_manuals/         # 利用者/運用/手順書
70_reviews/         # レビュー/総括
  phase1/
  phase2/
90_meta/            # 一覧・運用補助
99_archived/        # 旧版・保管
  phase1/
  phase2/
```

## 3. 命名ルール（統一）
- 形式: `NN_日本語_English.md`（NNは並び順）
- Phaseはファイル名とメタ情報で明示（例: `Phase2`）
- 各md冒頭にメタ情報行を追加: `対象フェーズ` / `状態` / `最終更新日`

## 4. 完全移行マップ（全md）
| No. | 現在 | 移行先 | アクション | フェーズ | 備考 |
| --- | --- | --- | --- | --- | --- |
| 1 | README.md | README.md | KEEP | 共通 | ルートREADMEは維持。新ドキュメント索引へのリンク追加 |
| 2 | apps/v1-legacy/README.md | apps/v1-legacy/README.md | KEEP | Phase 1 | アプリ内READMEは維持 |
| 3 | apps/v2-modern/README.md | apps/v2-modern/README.md | KEEP | Phase 2 | アプリ内READMEは維持 |
| 4 | apps/v2-modern/implementation_plan.md | docs/10_planning/phase2/09_実装計画_Phase2_Implementation_Plan.md | MOVE+RENAME | Phase 2 | 計画の正式配置 |
| 5 | apps/v2-modern/review.md | docs/70_reviews/phase2/03_v2-modern_Review.md | MOVE+RENAME | Phase 2 | 辛口レビューをレビュー集へ |
| 6 | docs/ARCHITECTURE.md | docs/30_design/00_アーキテクチャ概要_Architecture_Overview.md | MOVE+RENAME | Phase 2 | 既存アーキ設計と統合・重複整理 |
| 7 | docs/PRESENTATION.md | docs/00_overview/02_技術構成プレゼン_Presentation.md | MOVE+RENAME | 共通 | 概要フォルダへ |
| 8 | docs/PHASE2_SETUP.md | docs/50_manuals/00_環境構築_Phase2_Setup.md | MOVE+RENAME | Phase 2 | セットアップ手順をマニュアル化 |
| 9 | docs/implementation_plan_review.md | docs/70_reviews/phase2/01_実装計画レビュー_Phase2.md | MOVE+RENAME | Phase 2 | レビュー集へ |
|10 | docs/MD_FILE_LIST.md | docs/90_meta/MD_FILE_LIST.md | MOVE | 共通 | メタ情報へ |
|11 | docs/00_planning/README.md | docs/10_planning/README.md | MOVE | Phase 2 | 計画トップ索引に更新 |
|12 | docs/00_planning/01_品質改善提案_Quality_Improvement.md | docs/10_planning/phase2/03_品質改善提案_Quality_Improvement.md | MOVE+RENAME | Phase 2 | 計画内で順序調整 |
|13 | docs/00_planning/02_機能拡張一覧_Phase2x.md | docs/10_planning/phase2/01_機能拡張一覧_Phase2x.md | MOVE+RENAME | Phase 2 | フェーズ計画の先頭へ |
|14 | docs/00_planning/03_Phase2ロードマップ_Phase2_Roadmap.md | docs/10_planning/phase2/02_Phase2ロードマップ_Phase2_Roadmap.md | MOVE+RENAME | Phase 2 | ロードマップを明確に配置 |
|15 | docs/00_planning/04_要件定義書_REQUIREMENTS.md | docs/20_requirements/01_要件定義書_REQUIREMENTS.md | MOVE+RENAME | Phase 2 | 要件定義へ分離 |
|16 | docs/00_planning/05_技術仕様書_Technical_Spec.md | docs/30_design/10_技術仕様書_Technical_Spec.md | MOVE+RENAME | Phase 2 | 設計/仕様へ統合 |
|17 | docs/00_planning/06_システム設計書_System_Design.md | docs/30_design/02_システム設計書_System_Design.md | MOVE+RENAME | Phase 2 | 設計資料に統合 |
|18 | docs/00_planning/07_リファクタリング保留理由_Phase2.2.md | docs/10_planning/phase2/decisions/03_リファクタリング保留理由_Phase2.2.md | MOVE+RENAME | Phase 2 | 意思決定系へ |
|19 | docs/00_planning/Phase2.1_Decision_Matrix.md | docs/10_planning/phase2/decisions/01_決定マトリクス_Phase2.1.md | MOVE+RENAME | Phase 2 | 意思決定系へ |
|20 | docs/00_planning/Phase2.2_Decision_Matrix.md | docs/10_planning/phase2/decisions/02_決定マトリクス_Phase2.2.md | MOVE+RENAME | Phase 2 | 意思決定系へ |
|21 | docs/00_planning/implementation_plan_review_report.md | docs/70_reviews/phase2/02_実施可否レポート_Phase2.2.md | MOVE+RENAME | Phase 2 | レビュー集へ |
|22 | docs/00_planning/tests/phase2.2/08_実装有無比較テストレポート_Phase2.2.md | docs/40_testing/phase2.2/01_実装有無比較テストレポート_Phase2.2.md | MOVE+RENAME | Phase 2 | テスト結果へ |
|23 | docs/10_manuals/01_iPhoneテスト手順書_iPhone_Test_Guide.md | docs/50_manuals/01_iPhoneテスト手順書_iPhone_Test_Guide.md | MOVE | Phase 2 | マニュアルへ |
|24 | docs/10_manuals/02_利用者ガイド_User_Guide.md | docs/50_manuals/02_利用者ガイド_User_Guide.md | MOVE | Phase 2 | マニュアルへ |
|25 | docs/10_manuals/03_OPS_GUIDE.md | docs/50_manuals/03_運用ガイド_OPS_Guide.md | MOVE+RENAME | Phase 2 | 命名統一 |
|26 | docs/20_reviews/01_Phase1総括_Phase1_Review_Summary.md | docs/70_reviews/phase1/01_Phase1総括_Phase1_Review_Summary.md | MOVE | Phase 1 | Phase1レビュー集へ |
|27 | docs/30_design/01_システムアーキテクチャ_System_Architecture.md | docs/30_design/01_システムアーキテクチャ_System_Architecture.md | KEEP | Phase 2 | 番号は維持 |
|28 | docs/30_design/02_機能設計_Phase2_Detail.md | docs/30_design/20_機能設計_Phase2_Detail.md | RENAME | Phase 2 | 設計内の並び順調整 |
|29 | docs/30_design/03_API設計_API_Design.md | docs/30_design/30_API設計_API_Design.md | RENAME | Phase 2 | 設計内の並び順調整 |
|30 | docs/30_design/04_データモデル設計_Data_Model.md | docs/30_design/40_データモデル設計_Data_Model.md | RENAME | Phase 2 | 設計内の並び順調整 |
|31 | docs/30_design/05_対話UX設計_Conversation_UX.md | docs/30_design/50_対話UX設計_Conversation_UX.md | RENAME | Phase 2 | 設計内の並び順調整 |
|32 | docs/99_archived/old_05_Technical_Spec.md | docs/99_archived/phase2/old_05_Technical_Spec.md | MOVE | Phase 2(Archive) | 旧版保管 |
|33 | docs/99_archived/debugging/01_iPhone接続検証レポート.md | docs/99_archived/phase1/testing/01_iPhone接続検証レポート.md | MOVE | Phase 1(Archive) | 旧検証 |
|34 | docs/99_archived/planning/01_企画書_Project_Plan.md | docs/99_archived/phase1/planning/01_企画書_Project_Plan.md | MOVE | Phase 1(Archive) | 旧企画 |
|35 | docs/99_archived/planning/02_要件定義書_Requirements.md | docs/99_archived/phase1/planning/02_要件定義書_Requirements.md | MOVE | Phase 1(Archive) | 旧要件 |
|36 | docs/99_archived/planning/03_詳細設計書_Detailed_Design.md | docs/99_archived/phase1/planning/03_詳細設計書_Detailed_Design.md | MOVE | Phase 1(Archive) | 旧詳細設計 |
|37 | docs/99_archived/planning/04_AI対話設計_AI_Dialogue_Design.md | docs/99_archived/phase1/planning/04_AI対話設計_AI_Dialogue_Design.md | MOVE | Phase 1(Archive) | 旧AI対話設計 |
|38 | docs/99_archived/planning/05_UIUX設計_UI_UX_Design.md | docs/99_archived/phase1/planning/05_UIUX設計_UI_UX_Design.md | MOVE | Phase 1(Archive) | 旧UIUX設計 |
|39 | docs/99_archived/planning/06_音声テスト計画_Speech_Test_Plan.md | docs/99_archived/phase1/planning/06_音声テスト計画_Speech_Test_Plan.md | MOVE | Phase 1(Archive) | 旧音声テスト計画 |
|40 | docs/99_archived/planning/07_ハンズフリー構想_Future_Handsfree.md | docs/99_archived/phase1/planning/07_ハンズフリー構想_Future_Handsfree.md | MOVE | Phase 1(Archive) | 旧構想 |
|41 | docs/99_archived/planning/08_タスク一覧_Task_List.md | docs/99_archived/phase1/planning/08_タスク一覧_Task_List.md | MOVE | Phase 1(Archive) | 旧タスク一覧 |
|42 | docs/99_archived/planning/09_初期レビュー_Initial_Review.md | docs/99_archived/phase1/planning/09_初期レビュー_Initial_Review.md | MOVE | Phase 1(Archive) | 旧初期レビュー |
|43 | docs/99_archived/planning/10_徹底検証レポート_Validation_Report.md | docs/99_archived/phase1/planning/10_徹底検証レポート_Validation_Report.md | MOVE | Phase 1(Archive) | 旧検証レポート |
|44 | docs/99_archived/reference/KY活動表サンプル.md | docs/50_manuals/reference/KY活動表サンプル.md | MOVE | 共通 | 参照価値が高いのでマニュアルへ昇格 |
|45 | docs/99_archived/reviews/performance_review.md | docs/99_archived/phase1/reviews/performance_review.md | MOVE | Phase 1(Archive) | 旧レビュー |
|46 | docs/99_archived/reviews/REVIEW_PDF.md | docs/99_archived/phase1/reviews/REVIEW_PDF.md | MOVE | Phase 1(Archive) | 旧レビュー |
|47 | docs/99_archived/reviews/REVIEW_repo.md | docs/99_archived/phase1/reviews/REVIEW_repo.md | MOVE | Phase 1(Archive) | 旧レビュー |
|48 | docs/99_archived/reviews/REVIEW_パフォーマンス.md | docs/99_archived/phase1/reviews/REVIEW_パフォーマンス.md | MOVE | Phase 1(Archive) | 旧レビュー |
|49 | docs/99_archived/reviews/REVIEW_対応レポート.md | docs/99_archived/phase1/reviews/REVIEW_対応レポート.md | MOVE | Phase 1(Archive) | 旧レビュー |
|50 | docs/99_archived/reviews/security_report.md | docs/99_archived/phase1/reviews/security_report.md | MOVE | Phase 1(Archive) | 旧レビュー |

## 5. 追加で移動する関連ファイル（非md）
- docs/00_planning/tests/phase2.2/phase22_perf_bench_results.json → docs/40_testing/phase2.2/phase22_perf_bench_results.json
- docs/00_planning/tests/phase2.2/phase22_perf_bench.mjs → docs/40_testing/phase2.2/phase22_perf_bench.mjs

## 6. 実施手順（安全順）
1. 新フォルダ作成（00_overview/10_planning/20_requirements/40_testing/50_manuals/70_reviews/90_meta など）
2. mdの移動・リネーム（上表の順に実施）
3. 参照リンクの更新（相対パスの更新）
4. 各フォルダにREADMEを追加し、索引化
5. md先頭にメタ情報を追記（対象フェーズ/状態/最終更新日）
6. MD_FILE_LIST.md を再生成

## 7. 補足
- 移行後、Phase1はレビュー/アーカイブに集約、Phase2は計画・設計・テストに集約する運用に切り替える。
- 旧ファイルは原則削除ではなく移動（履歴保全）。
