# Feature06: KYボードUIUX + 会話フェーズ分離（実装レポート / v2-modern）

作成日時: 2026-02-11 01:32:13 +09:00  
作成者: Codex (GPT-5)  
更新日: 2026-02-11
更新日: 2026-02-11（危険度ボタンのローカル即遷移、KY完了の表記ゆれ許容、非回答「なし」の除外強化、危険2件上限のコード側強制）
更新日: 2026-02-11（E2E: 危険度ボタンはAPI待ち不要、PDF visualのスナップショット更新手順を追記）
更新日: 2026-02-11（KY完了コマンドの正規化をNFKCベースに強化、2件目保存時の行動目標ガイダンスを追加）
更新日: 2026-02-11（完了ボタンの表示条件を強化: `nextAction=completed` 依存を緩和し、行動目標確定時にも終了導線を表示）
更新日: 2026-02-11（HomePageの進行中セッション画面にもAPIトークン設定UIを表示）

## 目的

- 添付資料（KYボード + ステップバー）のUIUXに合わせる
- 会話フローを「危険内容確認」「危険度」「対策」に明確分離する
- 想定される危険は **2件固定**
- 2件目途中でも「KY完了」で本日のKYを完了（行動目標へスキップ）できるようにする

## 仕様（要点）

### 1) フェーズ分離

1. 危険内容の確認（KYボードを埋める）
   - 「何をするとき」→ `workDescription`
   - 「何が原因で」→ `whyDangerous`
   - 「どうなる」→ `hazardDescription`
   - AIがユーザー発話から判断して分類・メモに反映（不足分のみ追加質問）
2. 危険度を聞く
   - 1〜5（UIボタンも案内）
3. 対策を聞く
   - 「設備・環境」「人配置・行動」「保護具」の観点で聞き取り（1問1観点）
   - **対策は合計2件以上** そろえば完了（同カテゴリ内で2件でもOK）

### 2) 完了判定（危険1件の保存条件）

以下がそろったときに、危険1件を保存します。

- `workDescription` が空でない
- `whyDangerous` が1件以上（空文字除外）
- `hazardDescription` が空でない
- `riskLevel` が設定済み（1〜5）
- `countermeasures` が **合計2件以上**（空文字除外、ユーザーの「なし」はカウントしない）

### 3) 2件固定 + KY完了ショートカット

- 1件目完了後、KYボードをリセットして2件目へ進む
- 2件目の途中でも、ユーザーが **「KY完了」** と入力した場合は本日のKYを完了に進める
  - 条件: 1件目が保存済み（`workItemCount >= 1`）かつ `status === work_items`
  - 動作: 未完成の2件目は破棄し、行動目標フェーズへ遷移

## 実装内容（変更点）

### UI

- `apps/v2-modern/src/components/KYBoardCard.tsx` を新規追加
  - 添付資料のKYボードUIに近いテーブル表示（危険1件目/2件目、危険度、対策カテゴリ欄）
- `apps/v2-modern/src/pages/KYSessionPage.tsx`
  - 作業・危険フェーズで `KYBoardCard` を表示
  - 進行バー（作業・危険 → 行動目標 → 確認）の表示を維持しつつ、完了ボタン表示条件を更新
  - 完了ボタンは `lastAssistantNextAction === completed` だけでなく、`status === confirmation` または `status === action_goal` かつ `actionGoal` 設定済みでも表示するよう改善
- `apps/v2-modern/src/pages/HomePage.tsx`
  - APIトークン設定UIを共通化し、新規開始フォームだけでなく「進行中セッションあり」の分岐画面からも更新可能に改善

### 会話・状態遷移

- `apps/v2-modern/src/hooks/useChat.ts`
  - 初期メッセージを「1件目の危険内容確認」開始に変更
  - `extracted.nextAction` に応じたフェーズ遷移を整理
  - **「KY完了」** のローカルショートカット処理を追加（APIコール無しで行動目標へ）
  - **危険度（1〜5）ボタンはローカル処理で即座に対策フェーズへ遷移**（APIコール無し）
  - **「KY完了」コマンドの表記ゆれ（`ky 完了` / `ＫＹ 完了` 等）を許容**
  - UI操作（危険度ボタン）とAPI応答が競合するケースに備え、抽出データ統合時に最新state参照へ修正

### プロンプト

- `apps/v2-modern/workers/prompts/soloKY.ts`
  - 2件固定（`session_context_json.workItemCount` で 1件目/2件目を判断）
  - 3フェーズ（危険内容→危険度→対策）を順序厳守
  - 対策は合計2件以上を満たすまで継続
  - 「KY完了」ショートカットの扱いを明記

### バリデーション/文言

- `apps/v2-modern/src/lib/validation.ts`
  - 危険1件の完了判定を「対策カテゴリ数」ではなく **対策合計2件以上** に変更
  - **非回答（「なし/特になし/ありません」等）は対策/要因のカウントから除外**（誤保存防止）
- `apps/v2-modern/src/stores/slices/workItemSlice.ts`
  - 未完了時のエラー文言を仕様に合わせて更新
  - **危険は最大2件までをコード側で強制**（AIの誤誘導でも3件目に進まない）

### PDF/要約表示

- `apps/v2-modern/src/components/pdf/KYSheetPDF.tsx`
  - 表示ラベルを「危険」「何をするとき/何が原因で/どうなる」に合わせて更新
- `apps/v2-modern/src/lib/chat/conversationSummary.ts`
  - 画面のKYボード表現に合わせて要約ラベルを更新

## テスト（実施結果）

- `apps/v2-modern` unit/integration: `npm test`（75/75 PASS）
- E2E: `npm run test:e2e`（PASS。PDF visualは環境差でflakyになり得る）
- E2E注意点（危険度ボタン）: 危険度（1〜5）ボタンは **APIを呼ばない** ため、E2Eは `**/api/chat` の `waitForResponse` を置かず、UI変化（危険度セレクタ消失/ローカル挿入メッセージ表示）を待つ
- E2E注意点（PDF visual）: PDFビューア/描画方式の変更で差分が出やすい。ベースライン更新は `npx playwright test tests/e2e/pdf-visual.spec.ts --update-snapshots`（生成先: `apps/v2-modern/tests/e2e/pdf-visual.spec.ts-snapshots/`）
- 実費テスト（最大10回許容の範囲で実施）:
  - DRY_RUN: `DRY_RUN=1 npm run test:cost`（PASS）
  - LIVE: `npm run test:cost:preflight`（PASS）→ `npm run test:cost:live`（PASS、**1回** 実行）

## 備考

- `tests/e2e/real-cost-scenario.spec.ts` は新フロー（危険2件＋KY完了スキップ）に合わせて更新済みです。
