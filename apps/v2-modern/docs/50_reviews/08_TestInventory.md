# フェーズ2 テスト一覧 (Test Inventory)

Voice KY Assistant (v2-modern) のフェーズ2開発における全テストのリストです。

## 1. 単体テスト & 統合テスト (Unit & Integration)

`vitest` を使用して実行される、高速なフィードバックループのためのテスト群です。

**実行コマンド**: `npm run test`

| ファイル名 | カテゴリ | 内容 | 評価項目 | 補足 |
|---|---|---|---|---|
| `tests/unit/schema.test.ts` | Unit | Zodスキーマ (`ChatMessageSchema` 等) のバリデーションロジックをテストします。 | ・正しいデータが検証を通過すること<br>・不正なデータ（長すぎる、システムロール、制御文字など）が弾かれること | 型安全性を保証する基盤テストです。 |
| `tests/unit/kyStore.test.ts` | Unit | Zustandストア (`useKYStore`) の状態管理ロジックをテストします。 | ・セッション開始時に状態が正しく初期化されるか<br>・メッセージ追加、作業項目更新、コミットが正しく動作するか<br>・完了時のステータス遷移が正しいか | フロントエンドの状態管理の正しさを保証します。 |
| `tests/integration/integration.test.ts` | Integration | Hono APIワーカー (`workers/routes/chat.ts`) のエンドポイント統合テストです。`fetch` をモックしてリクエスト/レスポンス構造を検証します。 | ・`/api/chat` が 200 OK を返すか<br>・OpenAIからのレスポンス構造 (`extracted` 含む) がクライアント期待の形式に変換されているか<br>・JSONパースエラー時のグレースフルなハンドリング | バックエンドロジックの結合テストです。 |

<br>

## 2. E2E テスト (End-to-End)

Playwright を使用したブラウザベースのシナリオテストです。

**全件実行コマンド**: `npm run test:e2e`

### A. 機能確認・回帰テスト (Mocked)

OpenAI API をモックし、UIフローとロジックの正当性をコストをかけずに検証します。CI/CDに適しています。

| ファイル名 | テスト名 | 内容 | 評価項目 | 補足 |
|---|---|---|---|---|
| `tests/e2e/ky-session-e2e.spec.ts` | KY Session E2E (Consolidated) | **[統合版]** 標準フロー(PDF生成まで)、高所作業、最小入力シナリオを網羅するメインのE2Eテストです。 | ・正常系の全画面遷移<br>・エッジケースでの堅牢性<br>・モックを使用した安定動作 | `basic-flow.spec.ts` を統合し、カバレッジを向上させました。 |
| `tests/unit/metrics.test.ts` | Unit (New) | **[Phase 2.5]** KPI計測ロジック（会話ターン数、ループ検知）をテストします。 | ・正しい計算ロジック<br>・異常値の検出 | 新規追加。 |
| `tests/integration/feedback.test.ts` | Integration (New) | **[Phase 2.6]** フィードバック生成APIのモックテストです。 | ・200 OKレスポンス<br>・スキーマ準拠 | 新規追加。 |
| `tests/unit/historyUtils.test.ts` | Unit (New) | **[Phase 2.7]** 履歴取得・フィルタリングロジックをテストします。 | ・類似性判定の正確さ<br>・データ上限（100件）の動作 | 新規追加。 |
| `tests/e2e/pdf-visual.spec.ts` | PDF Visual Regression | PDFプレビュー画面 (`/debug/pdf`) のレンダリング結果をスクリーンショット比較します。 | ・PDFビューア (`@react-pdf/renderer`) が正しくキャンバスを描画しているか<br>・レイアウト崩れがないか | ビジュアルリグレッションテストです。 |
| `tests/e2e/ios_compatibility.spec.ts` | iOS Compatibility | iOS (WebKit) 環境での簡易スモークテストです。 | ・タイトルが表示されるか<br>・クリティカルなJSエラーがないか | iPhone実機テスト前の最低限の確認用です。 |

### B. 実環境・コスト検証テスト (Live / Cost)

実際の OpenAI API を使用する、または本番相当の複雑な対話ロジックを検証するテストです。

**これらは `npm run test:e2e` ではデフォルトでスキップされます（環境変数が必要）。**

| ファイル名 | 実行コマンド | 内容 | 評価項目 | 補足 |
|---|---|---|---|---|
| `tests/e2e/live-ai-chat.spec.ts` | `npm run test:live` | **[課金あり]** 実際のOpenAI APIに接続し、AIとの「会話」が成立するかを確認します。モックでは検知できないAPI仕様変更や接続エラーを検出します。 | ・実際のAIが文脈を理解して応答するか<br>・吹き出しが正しく増えるか<br>・エラーアラートが出ないか | `RUN_LIVE_TESTS=1` が必要。<br>本番デプロイ前の最終確認用。 |
| `tests/e2e/real-cost-scenario.spec.ts` | `npm run test:cost` | **[課金あり/なし]** 実際の業務シナリオ（溶接作業）を最初から最後まで通し、レスポンス時間やトークン消費（コスト）、エラー率を計測・レポート化します。<br>Dry Runモード (`DRY_RUN=1`) もサポート。 | ・全5ターンの会話が完走すること<br>・AI応答時間が閾値以内 (例: 5秒) か<br>・Markdownレポートが生成されるか | パフォーマンス計測とコスト試算のためのメインツール。<br>Dry Runでロジック確認、Liveで実測を行います。 |

## 3. その他のスクリプト

`package.json` で定義されているその他の関連コマンドです。

- `npm run test:iphone`: Playwright Codegen を iPhone 13 エミュレーションモードで起動します（テスト作成用）。
- `npm run dev:iphone`: ローカルネットワーク (`--host`) と Workers を同時に立ち上げ、実機iPhoneからのアクセスを可能にします。
