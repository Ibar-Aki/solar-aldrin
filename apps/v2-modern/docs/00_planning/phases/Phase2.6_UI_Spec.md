# Phase 2.6 UI仕様（表示条件/スキップ/ローディング）

- 作成日時: 2026-02-02 00:22
- 作成者: Codex + 0.93.0
- 更新日: 2026-02-02
- 対象資料: Phase2.6_Implementation_Plan.md

---

## 1. 目的

- 完了画面でのフィードバック表示を **確実に崩さず** 提供する。
- 失敗時や空データ時に自然にスキップできるUIを定義する。

---

## 2. 呼び出しタイミング

- `CompletionPage.tsx` の表示時に1回だけ `POST /api/feedback` を実行。
- 以下条件のいずれかで **呼び出し自体をスキップ**:
  - `ENABLE_FEEDBACK=0`
  - `sessionId` 不在
  - ユーザーが「今回はスキップ」を選択済み

---

## 3. 表示条件（カード別）

**FeedbackCard**

- 表示: `praise` と `tip` がともに非空。
- 非表示: 取得失敗 / `praise` or `tip` が空 / スキップ選択。

**SupplementCard**

- 表示: `supplements.length >= 1`。
- 非表示: `supplements.length === 0` / 取得失敗 / スキップ選択。

**GoalPolishCard**

- 表示: `polishedGoal != null` かつ `polished` が非空。
- 非表示: `polishedGoal == null` / 取得失敗 / スキップ選択。

---

## 4. ローディング設計

- API呼び出し中は **各カードのSkeleton** を表示。
- 300ms未満で応答した場合はSkeletonを出さない（ちらつき防止）。
- タイムアウト（6秒）時は **全カード非表示** に切り替え、完了画面は通常表示を維持。

---

## 5. エラー/空データ時の挙動

- エラー時はトースト等を出さず、静かに非表示。
- `supplements` が0件のときは「AI補足」セクション自体を出さない。
- `polishedGoal` が `null` のときは添削カードを出さない。
- **部分成功**（例: `praise`のみ取得）でも、成立するカードのみ表示。

---

## 6. スキップUI

- 完了画面に「今回はスキップ」ボタンを配置。
- 押下時:
  - ストアに `feedbackSkipped=true` を保存
  - API呼び出しを中止（未実行の場合はキャンセル）
  - 既に表示しているカードも非表示

---

## 7. ゴール添削のユーザー操作

- 「採用する」:
  - `polishedActionGoal` に `polished` を保存
  - PDF出力は添削後を使用
- 「元のままでOK」:
  - `polishedActionGoal` を保持しない
  - PDF出力は元の `actionGoal` を使用

---

## 8. PDF出力の反映条件

- Feedback: `praise/tip` が有効なときのみセクション追加。
- Supplements: 1件以上あるときのみ追加。
- Goal: 採用済みのときのみ添削後を反映。

---

## 9. 最低限のUI検証シナリオ

- `ENABLE_FEEDBACK=0` でAPI呼び出しが発生しない
- タイムアウト時にSkeletonが消え、UIが崩れない
- `supplements=[]` のときセクションが出ない
- `polishedGoal=null` のときカードが出ない
- スキップ押下で全カードが非表示になる
