# Feature06: KYボードUIUX + 会話フェーズ分離（実装レポート / v2-modern）

作成日時: 2026-02-11 01:32:13 +09:00  
作成者: Codex (GPT-5)  
更新日: 2026-02-11
更新日: 2026-02-11（危険度ボタンのローカル即遷移、KY完了の表記ゆれ許容、非回答「なし」の除外強化、危険2件上限のコード側強制）
更新日: 2026-02-11（E2E: 危険度ボタンはAPI待ち不要、PDF visualのスナップショット更新手順を追記）
更新日: 2026-02-11（KY完了コマンドの正規化をNFKCベースに強化、2件目保存時の行動目標ガイダンスを追加）
更新日: 2026-02-11（完了ボタンの表示条件を強化: `nextAction=completed` 依存を緩和し、行動目標確定時にも終了導線を表示）
更新日: 2026-02-11（HomePageの進行中セッション画面にもAPIトークン設定UIを表示）
更新日: 2026-02-11（危険2件完了後の「KY完了」で自動完了し、完了画面へ自動遷移）
更新日: 2026-02-11（危険2件到達時の完了導線を安定化し、完了ボタンを強制表示するガードを追加）
更新日: 2026-02-11（添付準拠UI調整: KYボード見出し再配置、危険4項目完了後のみ対策表表示、マイクエラー表示位置を入力上段へ変更）
更新日: 2026-02-11（完了ボタンの強制表示条件を再調整し、2件到達時でも終盤状態のみ表示するよう限定）
更新日: 2026-02-11（Mobile Safari見た目合わせ: KYボード列比率/余白の微調整、入力エリアのボタン比率とエラーバッジ配置を調整）
更新日: 2026-02-11（実費テスト再現性改善: length切れ自動再生成、行動目標の重複質問抑止、metrics 405対策、LIVEトークン解決の安定化）
更新日: 2026-02-11（実費エラー改善: 空文字length応答の再生成救済、スキーマエラー詳細化、UIエラーメッセージの混雑/形式エラー分離）
更新日: 2026-02-11（1件目KYの対策追加入力導線を改善: 2件目対策直後の自動遷移停止、3件目のみ追記、`1件目完了` ボタン導入）

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
- 危険2件が保存済みの状態でユーザーが **「KY完了」** と入力した場合は、API呼び出し無しで即時に `status=completed` に遷移
  - 動作: 完了画面（`/complete`）へ自動遷移し、完了導線を短縮

## 実装内容（変更点）

### UI

- `apps/v2-modern/src/components/KYBoardCard.tsx` を新規追加
  - 添付資料のKYボードUIに近いテーブル表示（危険1件目/2件目、危険度、対策カテゴリ欄）
- `apps/v2-modern/src/pages/KYSessionPage.tsx`
  - 作業・危険フェーズで `KYBoardCard` を表示
  - 進行バー（作業・危険 → 行動目標 → 確認）の表示を維持しつつ、完了ボタン表示条件を更新
  - 完了ボタンは `lastAssistantNextAction === completed` だけでなく、`status === confirmation` または `status === action_goal` かつ `actionGoal` 設定済みでも表示するよう改善
  - 危険が2件保存済み (`workItemCount >= 2`) の場合でも、`action_goal / confirmation / nextAction=completed / actionGoal設定済み` の終盤状態に限定して完了ボタンを表示
  - 1件目で対策2件が揃った時点で `1件目完了` ボタンを表示し、**ボタン押下時にのみ** 2件目KYへ遷移
  - 1件目で対策3件目まで入力された場合は、入力欄を隠して `1件目完了` ボタンのみ表示
- `apps/v2-modern/src/pages/HomePage.tsx`
  - APIトークン設定UIを共通化し、新規開始フォームだけでなく「進行中セッションあり」の分岐画面からも更新可能に改善

### UI（2026-02-11 追加調整）

- `apps/v2-modern/src/components/KYBoardCard.tsx`
  - 見出し配置を添付準拠に更新（`KYボード` 右上へ `【n件目】`）
  - 表ヘッダを「想定される危険」+ 右列「危険度」に再配置
  - 文言を「何をする時」へ変更
  - 対策カテゴリ表示を「配置・行動」に統一
  - **危険4項目（何をする時 / 何が原因で / どうなる / 危険度）完了後のみ** 対策表を表示
  - 「危険への対策」行は薄いクリーム色に変更し、注意書きをヘッダへ統合
    - `危険への対策（対策は2件以上が必要です）`
- `apps/v2-modern/src/components/ChatInput.tsx` / `apps/v2-modern/src/components/MicButton.tsx`
  - マイクボタンを添付比率に合わせて調整
  - マイクエラー表示をボタン直下から撤廃し、**入力欄の上段・左寄せ**で表示する構成へ変更
  - Mobile Safari向けに、送信ボタン/マイクボタンのサイズ比率を再調整（モバイルで一段小さく、`sm` 以上は従来比率）
  - マイクエラー表示を黄色系バッジ（枠あり）で表示し、添付見た目に寄せた
- `apps/v2-modern/src/components/KYBoardCard.tsx`
  - Mobile Safari向けに左列:右列を `5:7`（`sm`以上は `4:8`）へ変更
  - 行内余白・フォントサイズをモバイルで微調整し、表全体の密度を添付比率に近づけた
- `apps/v2-modern/src/pages/KYSessionPage.tsx`
  - 入力エリアの左右/上下余白をモバイルでわずかに縮小し、下部固定バーの見た目を調整

### 会話・状態遷移

- `apps/v2-modern/src/hooks/useChat.ts`
  - 初期メッセージを「1件目の危険内容確認」開始に変更
  - `extracted.nextAction` に応じたフェーズ遷移を整理
  - **「KY完了」** のローカルショートカット処理を追加（APIコール無しで行動目標へ）
  - **危険2件完了済み + 「KY完了」** では APIコール無しでセッションを `completed` へ遷移
  - **危険度（1〜5）ボタンはローカル処理で即座に対策フェーズへ遷移**（APIコール無し）
  - **「KY完了」コマンドの表記ゆれ（`ky 完了` / `ＫＹ 完了` 等）を許容**
  - UI操作（危険度ボタン）とAPI応答が競合するケースに備え、抽出データ統合時に最新state参照へ修正
  - 行動目標フェーズで目標入力が明確な場合、**API呼び出し無しでローカル確定**（`ask_goal` 重複質問の抑止）
  - API応答が誤って `nextAction=ask_goal` を返した場合でも、ユーザー入力から行動目標を復元して `confirm` へ補正
  - 1件目KYで対策2件到達後は、AIの `nextAction` による自動コミットを抑止し、確認文
    - `他に何か対策はありますか？それとも、2件目のKYに移りますか？`
    を必ず表示
  - 1件目KYでは対策3件目のみ追記可能とし、4件目以降は受け付けず `1件目完了` 操作を案内
  - 「2件目のKYに移る」旨のテキスト入力でも、API呼び出し無しで1件目を確定し
    - `次の、2件目の想定される危険を教えてください。`
    を表示して2件目へ移行
- `apps/v2-modern/src/pages/KYSessionPage.tsx`
  - `status === completed` を監視し、ストア側で完了になったケースでも `/complete` へ自動遷移するよう補強

### 実費運用・再現性（2026-02-11 追加）

- `apps/v2-modern/workers/routes/chat.ts`
  - OpenAI応答の `finish_reason=length` かつ JSON破損時に、**1回だけ出力枠を拡張して再生成**する復旧処理を追加
  - これにより `AI_RESPONSE_INVALID_JSON` の断続発生を低減（再生成に成功した場合は通常応答へ復帰）
  - 空文字応答（`preview=""`）でも parse失敗として扱い、`finish_reason=length` 条件で再生成へ進むよう判定を厳密化
  - `AI_RESPONSE_INVALID_SCHEMA` の `details` を `reason/finishReason/issueCount/issues` 形式へ要約し、再現分析を容易化
- `apps/v2-modern/src/hooks/useChat.ts`
  - `AI_RESPONSE_INVALID_JSON` / `AI_RESPONSE_INVALID_SCHEMA` を「混雑」扱いにせず、形式エラー専用メッセージへ分岐
  - これにより、ユーザー向け再試行案内と運用側の原因切り分けの整合性を改善
- `apps/v2-modern/src/lib/observability/telemetry.ts`
  - `VITE_TELEMETRY_ENDPOINT` が相対指定でも、`VITE_API_BASE_URL` が絶対URLのときは同一API originへ正規化
  - Pagesドメインへ誤送信していた `/api/metrics` の **405 ノイズ**を抑制
- `apps/v2-modern/tests/e2e/real-cost-scenario.spec.ts`
  - LIVE実行時に `.dev.vars` の `API_TOKEN` を事前に `VITE_API_TOKEN` へ昇格し、テスト内フォールバック分岐を削減
  - Browser Console収集に location 情報を付与し、`405` 等の発生源追跡を容易化

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
