# リファクタリング & レビュー ガイドライン

大規模なリファクタリングや機能追加を行う際に遵守すべきプロセスと観点です。
「動けばいい」ではなく、保守性・可読性・堅牢性を重視します。

## 1. 開発フローの原則

1. **Plan First**: 実装前に必ず `Implementation Plan` を作成し、影響範囲と変更内容を定義する。
2. **Lint Check**: コミット前に必ず `npm run lint` (`eslint`) と `tsc -b` (`typescript` コンパイルチェック) を通す。
    * 未使用のインポート (`no-unused-vars`)
    * `any` 型の使用禁止
    * `useEffect` の依存配列漏れ (`react-hooks/exhaustive-deps`)
3. **Type Safety**: `as` (Type Assertion) は極力避ける。ZodなどのランタイムチェックやType Guard関数を使用する。

## 2. レビュー観点（セルフチェックリスト）

コードを書き終えたら、以下の観点でセルフレビューを行ってください。

### 🏗️ 構造・設計

- [ ] コンポーネントは大きすぎないか？（1ファイル300行を超えるなら分割を検討）
* [ ] ビジネスロジックがコンポーネント内にベタ書きされていないか？（Custom Hook や Store Action に切り出す）
* [ ] 定数はハードコーディングせず、定数ファイルやか設定ファイルに定義されているか？

### 🛡️ 安全性・エラーハンドリング

- [ ] `null` / `undefined` の可能性を考慮しているか？（Optional Chaining `?.` や Nullish Coalescing `??` の活用）
* [ ] 非同期処理のエラーは `try-catch` で捕捉されているか？
* [ ] `z.safeParse` を使用して外部データの整合性をチェックしているか？

### 🚀 パフォーマンス

- [ ] 不要な再レンダリングが発生していないか？（`useMemo`, `useCallback` の適切な使用）
* [ ] `console.log` が残っていないか？

## 3. マージ・コミット基準

* **1コミット・1トピック**: 複数の無関係な修正を1つのコミットに混ぜない。
* **コミットメッセージ**: `feat:`, `fix:`, `refactor:`, `docs:` などのプレフィックスを付け、何をしたか明確にする。
  * 例: `feat(chat): add retry logic for API errors`
  * 例: `fix(pdf): resolve formatting issue with long text`

## 4. 万が一バグを混入させたら

1. **Revert**: 下手な修正を重ねる前に、一度正常に動いていた状態まで戻す（`git restore` / `revert`）。
2. **Reproduce**: 再現手順を確立し、テストコード（e2e または unit）を書く。
3. **Fix**: テストがパスするように修正を行う。
