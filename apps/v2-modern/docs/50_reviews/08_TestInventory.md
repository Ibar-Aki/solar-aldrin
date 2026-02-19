# フェーズ2 テスト一覧 (Test Inventory)

更新日: 2026-02-19（現行テストの全量棚卸しを追記）

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

---

## 4. 追記（2026-02-19）: 現行テストの全量棚卸し

この章は、`apps/v2-modern` の現時点のテスト資産を**実ファイルから再抽出**した結果です。

### 4.1 集計サマリー

- Unit: 45ファイル / 171ケース
- Integration: 5ファイル / 44ケース
- E2E: 5ファイル / 8ケース
- スナップショット資産: 6ファイル（`tests/e2e/pdf-visual.spec.ts-snapshots/*.png`）
- `apps/v1-legacy` 側: テストファイル（`*.test.*` / `*.spec.*`）は現時点で未配置

### 4.2 まず使う実行手順（目的別）

1. ローカルの高速回帰（UI/ロジック）
- `cd apps/v2-modern`
- `npm ci`
- `npm run test`
- 目的: Unit/Integration の網羅確認（Vitest）

2. モックE2E（課金なし）
- `cd apps/v2-modern`
- `npm run test:e2e`
- 目的: 主要画面遷移と回帰確認（Playwright）

3. 実費E2Eの安全実行（推奨手順）
- `cd apps/v2-modern`
- `npm run test:cost:preflight`
- `npm run test:cost:live`
- 目的: 本番相当API接続時の事前整合性確認 + 実費シナリオ検証

4. 実費E2Eの一括運用（レポート生成込み）
- `cd apps/v2-modern`
- `npm run test:cost:ops`
- 目的: preflight + live + perf集計を一気通貫で実行

5. 実ライブ会話スモーク（単発）
- `cd apps/v2-modern`
- `set RUN_LIVE_TESTS=1`
- `set OPENAI_API_KEY=...`（Gemini利用時は `GEMINI_API_KEY`）
- `npm run test:live`
- 目的: 実AI接続の最短確認

6. SentryのPriority5運用検証
- `cd apps/v2-modern`
- `set SENTRY_AUTH_TOKEN=...` など必要なSentry系環境変数を設定
- `npm run test:sentry:priority5`
- 目的: エラー収集、Sourcemap、Alert、Trace、Release Health の運用経路を検証

### 4.3 実費系テストの前提（重要）

- `test:cost:preflight` は `scripts/security/preflight-live-test.ps1` を実行し、次を確認します。
- `BaseUrl` / `API root` の解決
- `/api/health` 疎通
- `/api/metrics` の期待ステータス
- `/api/chat` 応答の `meta.server`（`policyVersion` / `responseFormat` / `parseRecoveryEnabled` / `openaiRetryCount` / `maxTokens`）
- `test:cost:live` は `LIVE_PREFLIGHT_PASSED=1` が前提で、preflight未通過時の無駄な課金実行を防止します。
- `real-cost-scenario.spec.ts` は `RUN_LIVE_TESTS=1`（実費）または `DRY_RUN=1`（疑似）で実行されます。

### 4.4 現行テストファイル一覧（全件）
## UNIT
| file | test cases | summary |
|---|---:|---|
| `apps/v2-modern/tests/unit/aiProvider.test.ts` | 4 | aiProvider helpers / AI_PROVIDER が gemini の場合は gemini を返し、それ以外は openai を返す / provider に応じた API キーを返す |
| `apps/v2-modern/tests/unit/api.chatError.test.ts` | 2 | postChat error classification / ネットワーク失敗を network として分類する / 429エラーを rate_limit として分類し Retry-After を保持する |
| `apps/v2-modern/tests/unit/api.feedbackError.test.ts` | 5 | postFeedback error classification / ネットワーク失敗を network として分類する / AbortErrorはそのまま再スローする |
| `apps/v2-modern/tests/unit/apiBase.test.ts` | 7 | normalizeApiBaseFromEnv / 未指定は /api にフォールバックする / 絶対URLは /api を補完する |
| `apps/v2-modern/tests/unit/chat.requestPayload.test.ts` | 3 | buildRequestMessages / user/assistant 以外の role を除外する / リトライ時は末尾のエラーメッセージを除外し、ユーザー入力の重複を避ける |
| `apps/v2-modern/tests/unit/chatBubble.autoSpeak.test.tsx` | 2 | ChatBubble auto speak / 完全音声会話モード時にAIメッセージを自動読み上げする（1回のみ） / ユーザーメッセージでは自動読み上げしない |
| `apps/v2-modern/tests/unit/chatInput.fullVoiceMode.test.tsx` | 3 | ChatInput full voice mode / 完全音声会話モードでは最終認識結果を自動送信する / 同一文言の連続確定は短時間で重複送信しない |
| `apps/v2-modern/tests/unit/chatInput.micError.test.tsx` | 1 | ChatInput mic error / マイクエラーを入力欄の上段メッセージ領域に表示する |
| `apps/v2-modern/tests/unit/completionPage.test.tsx` | 1 | CompletionPage / 未完了セッションでは完了化せず /session へ戻す |
| `apps/v2-modern/tests/unit/contextInjection.test.ts` | 3 | Context Injection / should inject weather context / should inject recent risks warning |
| `apps/v2-modern/tests/unit/envFlags.test.ts` | 3 | envFlags / parseBooleanFlag が true/false の代表値を解釈できる / parseBooleanFlag は未知値を null にする |
| `apps/v2-modern/tests/unit/greeting.test.ts` | 3 | getTimeGreeting / should return おはようございます！ between 05-11 / should return こんにちは！ between 12-17 |
| `apps/v2-modern/tests/unit/historyUtils.test.ts` | 5 | History Utils / should filter past risks by similarity / should exclude current session ID |
| `apps/v2-modern/tests/unit/homePage.apiTokenSettings.test.tsx` | 4 | HomePage API token settings / 通常環境では新規開始フォームにAPIトークン入力を表示しない / 通常環境では進行中セッション画面にもAPIトークン入力を表示しない |
| `apps/v2-modern/tests/unit/homePage.focusStylePreview.test.tsx` | 1 | HomePage focus style preview / A案本番採用後は比較モデルをHome画面に表示しない |
| `apps/v2-modern/tests/unit/homePage.sessionEntryNavigation.test.tsx` | 2 | HomePage session entry navigation / 新規開始時は entry=new を付与して session へ遷移する / 再開時は entry=resume を付与して session へ遷移する |
| `apps/v2-modern/tests/unit/kyBoardCard.test.tsx` | 13 | KYBoardCard / 1件目で未入力時は理想的なKYのプレースホルダーを表示する / 1件目でも入力済みの欄ではプレースホルダーを表示しない |
| `apps/v2-modern/tests/unit/kySchemas.extracted.test.ts` | 1 | ExtractedDataSchema (coercion/normalization) / should coerce legacy shapes (string arrays, string riskLevel, string whyDangerous) |
| `apps/v2-modern/tests/unit/kySchemas.workItem.test.ts` | 5 | WorkItemSchema / should reject when countermeasures has only 1 item / should accept when countermeasures has 2 items |
| `apps/v2-modern/tests/unit/kySessionPage.firstWorkItemFlow.test.tsx` | 7 | KYSessionPage first work item flow / 1件目で対策2件が揃うと「1件目完了」ボタンを表示する / 進捗バーに参考情報ボタンを表示し、国交省PDFリンクを設定する |
| `apps/v2-modern/tests/unit/kySessionPage.voiceBoot.test.tsx` | 5 | KYSessionPage initial voice boot / 再開かつ完全音声会話モードでは、初回ガイド音声を再生しマイク自動開始を待機する / 開始導線情報が無い場合は、初回ガイド音声を再生しない |
| `apps/v2-modern/tests/unit/kyStore.test.ts` | 7 | kyStore / starts a new session correctly / adds messages correctly |
| `apps/v2-modern/tests/unit/logger.test.ts` | 2 | logger masking / PIIと秘密情報をマスクする / logInfo出力でもマスクされた値が使われる |
| `apps/v2-modern/tests/unit/mergeExtractedData.test.ts` | 2 | mergeExtractedData / whyDangerous が欠落していても推論補完しない / 既存の whyDangerous がある場合は推論補完を追加しない |
| `apps/v2-modern/tests/unit/metrics.test.ts` | 3 | KPI & Metrics Logic / 会話ターン数を user 発言ベースで算出する / chat_error / retry_failed が連続するとエラーループと判定する |
| `apps/v2-modern/tests/unit/micButton.errorClear.test.tsx` | 2 | MicButton error UX / 入力欄に1文字入ったら音声エラー表示をクリアする / 音声エラーを親コンポーネントへ通知する |
| `apps/v2-modern/tests/unit/micButton.fullVoiceMode.test.tsx` | 5 | MicButton full voice mode / 完全音声会話モードでは自動開始し、自動再開を有効化する / 通常モードでは自動再開を無効化し、自動開始しない |
| `apps/v2-modern/tests/unit/micButton.transcriptFlow.test.tsx` | 2 | MicButton transcript flow / 完全音声会話モードでは中間結果も入力欄へ反映する / 通常モードでは確定結果のみ反映する |
| `apps/v2-modern/tests/unit/openaiHttpError.test.ts` | 3 | fetchOpenAICompletion - OpenAI HTTP errors / throws OpenAIHTTPErrorWithDetails with upstream message on 400 / passes through retry-after on 429 |
| `apps/v2-modern/tests/unit/openaiJsonCleanup.test.ts` | 3 | openai json cleanup / extracts JSON from fenced code blocks / extracts JSON from embedded fenced blocks with prose |
| `apps/v2-modern/tests/unit/rateLimit.test.ts` | 4 | rateLimit middleware / 本番でKV必須時に未設定なら503で遮断する / 開発環境ではKV未設定でもメモリフォールバックで通過する |
| `apps/v2-modern/tests/unit/riskLevelVisibility.test.ts` | 4 | shouldShowRiskLevelSelector / ask_risk_level かつ未選択のとき表示する / ask_why のとき表示しない |
| `apps/v2-modern/tests/unit/schema.test.ts` | 5 | ChatMessageSchema / should accept valid messages / should reject system role |
| `apps/v2-modern/tests/unit/securityMode.test.ts` | 3 | securityMode helpers / ENVIRONMENT / SENTRY_ENV が production の場合は本番扱いになる / APIトークン必須判定は明示フラグを優先する |
| `apps/v2-modern/tests/unit/speechRecognitionErrors.test.ts` | 2 | speechRecognitionErrors / normalizeSpeechRecognitionError: "service not allowed" を service-not-allowed に正規化する / getSpeechRecognitionErrorMessage: service-not-allowed は短い文言になる |
| `apps/v2-modern/tests/unit/useChat.retry.test.tsx` | 4 | useChat retry behavior / タイムアウト時のみリトライを有効化し、リトライでユーザーメッセージを重複送信しない / 非タイムアウトエラーではリトライを有効化しない |
| `apps/v2-modern/tests/unit/useChat.shortcuts.test.tsx` | 11 | useChat shortcuts / applyRiskLevelSelectionはAPIを呼ばず、対策フェーズへ進める / 1件目で2件目の対策が揃っても自動で2件目KYへ遷移せず、確認メッセージを表示する |
| `apps/v2-modern/tests/unit/useTTS.recovery.test.tsx` | 5 | useTTS recovery guard / TTS状態が固着した場合に自動で stopSpeaking する / speechSynthesis が実際に speaking 中なら固着回復は発火しない |
| `apps/v2-modern/tests/unit/useVoiceRecognition.resilience.test.tsx` | 5 | useVoiceRecognition resilience / 初回 start 失敗後も autoRestart で再試行して復帰する / onstart が返らない初回ハングでもウォッチドッグ経由で再試行して復帰する |
| `apps/v2-modern/tests/unit/validation.hazardSection.test.ts` | 4 | isHazardSectionComplete / 危険情報4項目がそろっていると true を返す / 危険度が未入力だと false を返す |
| `apps/v2-modern/tests/unit/validation.nonAnswer.test.ts` | 2 | validation - non-answer filtering / 対策の「なし」はカウントせず、完了扱いにならない / 要因の「特になし」はカウントせず、完了扱いにならない |
| `apps/v2-modern/tests/unit/voiceConversationMode.pages.test.tsx` | 2 | Voice conversation mode switch / ホーム画面は通常モードを初期表示し、切替できる / ホームで切替えた状態を会話画面でも共有し、会話画面から戻せる |
| `apps/v2-modern/tests/unit/workers/chat.execution.test.ts` | 3 | runChatCompletionFlow / finish_reason=length の壊れたJSONは1回だけ再生成して回復する / スキーマ不整合時は invalid_schema を返す |
| `apps/v2-modern/tests/unit/workers/chat.normalize.test.ts` | 3 | chat normalize helpers / 汎用的な相づち応答は会話進行用の文面へ補正する / actionGoal入力時に ask_goal を confirm に補正する |
| `apps/v2-modern/tests/unit/workers/fieldGuard.test.ts` | 5 | applyKyFieldGuard / 原因欄に作業文が混入している場合は除外し ask_why に戻す / 妥当な原因文は保持する |

## INTEGRATION
| file | test cases | summary |
|---|---:|---|
| `apps/v2-modern/tests/integration/feedback.test.ts` | 3 | Feedback API Integration / 正常系で200とフィードバック本文を返す / 同一セッション・同一クライアントの2回目はキャッシュヒットする |
| `apps/v2-modern/tests/integration/integration.test.ts` | 24 | Chat API Integration Flow / should process chat request and return structured JSON / AI_POLICY_VERSION が設定されている場合は policyVersion に最優先で反映する |
| `apps/v2-modern/tests/integration/metrics.route.test.ts` | 2 | Metrics Route / 許可されたイベントを受理する / 未定義イベントを拒否する |
| `apps/v2-modern/tests/integration/security.middleware.test.ts` | 10 | security middleware integration / 本番設定でAPI_TOKEN未設定なら503を返す / API_TOKEN設定時にAuthorizationなしなら401を返す |
| `apps/v2-modern/tests/integration/sentry.debug-endpoints.test.ts` | 5 | Sentry debug endpoints / ENABLE_SENTRY_TEST_ENDPOINT 未設定時は 404 を返す / 有効化時はバックエンド例外を意図的に発生させ、500 を返す |

## E2E
| file | test cases | summary |
|---|---:|---|
| `apps/v2-modern/tests/e2e/ios_compatibility.spec.ts` | 2 | HomePage loads correctly on WebKit / PDF Generation capability check |
| `apps/v2-modern/tests/e2e/ky-session-e2e.spec.ts` | 3 | 標準フロー: 開始からPDF完了まで (Happy Path) / 高所作業フロー（コンテキスト入力確認） |
| `apps/v2-modern/tests/e2e/live-ai-chat.spec.ts` | 1 | Live API: Real chat flow with OpenAI |
| `apps/v2-modern/tests/e2e/pdf-visual.spec.ts` | 1 | PDF debug preview visual regression |
| `apps/v2-modern/tests/e2e/real-cost-scenario.spec.ts` | 1 | Real-Cost: Full KY Scenario with Reporting |

### 4.5 補助スクリプト（テスト運用で実際に使うもの）

- `apps/v2-modern/scripts/security/preflight-live-test.ps1`
- 実費テスト前チェック（環境・疎通・policy整合）
- `apps/v2-modern/scripts/security/automate-security-ops.ps1`
- `security:local` 実行、必要時デプロイ、事後スモーク
- `apps/v2-modern/scripts/security/deploy-pages-with-worker-api.ps1`
- Worker API URL を固定し Pages を再デプロイ
- `apps/v2-modern/scripts/sentry/priority5-live-tests.mjs`
- Sentry運用観点の5大テスト（収集/復元/通知/トレース/リリース健全性）
- `apps/v2-modern/scripts/generate_perf_summary.mjs`
- 実費テスト結果の集計レポート生成
- `apps/v2-modern/scripts/prune_real_cost_reports.mjs`
- 実費レポートの整理
- `apps/v2-modern/scripts/start_iphone_test.ps1`
- 実機iPhoneでのアクセス確認用ローカル起動支援

### 4.6 全件詳細カタログ（223件）

- 全223件の `it(...)` / `test(...)` について、以下を1件ずつ記載した完全版です。
- 記載項目: `Layer` / `Category` / `File:Line` / `Context` / `Case` / `失敗時の影響` / `検証内容（詳細）`
- ファイル: `apps/v2-modern/docs/50_reviews/13_TestCase_Catalog_223cases_2026-02-19.md`
