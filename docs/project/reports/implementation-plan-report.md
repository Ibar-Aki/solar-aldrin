# 実装計画レポート（アプリ本体修正・詳細版）

- 作成日時: 2026-02-02 08:12
- 作成者: Codex GPT-5
- 更新日: 2026-02-07（ファイル整理：配置/ファイル名変更）

## 1. 目的
直近変更で顕在化した「静かな失敗」と「設定不足の検知遅延」を解消し、
ユーザーが原因に辿り着けるUXを担保する。また、UI・API・Worker間の
スキーマ整合とエラーハンドリングの一貫性を回復する。

## 2. 対象範囲
- 対象: アプリ本体コード（フロント/Worker/スキーマ/共有ロジック）
- 除外: テストコード、レポート生成、Playwright設定
- 代表ファイル:
  - apps/v2-modern/src/hooks/useChat.ts
  - apps/v2-modern/src/lib/api.ts
  - apps/v2-modern/src/lib/schema.ts
  - apps/v2-modern/workers/routes/chat.ts
  - apps/v2-modern/workers/index.ts
  - apps/v2-modern/src/components/ChatInput.tsx
  - apps/v2-modern/src/pages/debug/PDFDebugPage.tsx

## 3. 現状課題（要約）
1) Authトークン未設定時の検知が消失
- VITE_API_TOKEN 未設定でも送信され、401まで気づけない。

2) レスポンスが不正でも空メッセージとして通過
- reply欠落時に空文字を返すため、障害が「静かに」UIへ流れる。

3) レスポンス型検証がない
- res.json()の戻りが非オブジェクトでも想定外の例外が起きる。

4) 入力長制約の不一致
- UIは2000文字、サーバは1000文字のため送信失敗が起き得る。

5) PDF Debugの安全性低下（DEV）
- canvas.getContext 失敗時の安全策が消失。

## 4. 方針（決定ポイントと既定案）
- Auth不足検知は「クライアントで早期検知 + サーバで確実に弾く」の二段構成へ復帰。
- 既定案: VITE_REQUIRE_API_TOKEN=1 のときに送信前チェックを強制。
- レスポンス検証は Zod safeParse で厳格化し、不正形状は明示的エラー化。

## 5. 実装タスク詳細（ステップ順）

### Step 1: 入力長制約の一本化
目的: UI/サーバ制約の不一致を解消。

作業:
- apps/v2-modern/src/lib/schema.ts
  - USER_CONTENT_MAX_LENGTH を export const に変更。
- apps/v2-modern/src/components/ChatInput.tsx
  - maxLength を USER_CONTENT_MAX_LENGTH に合わせる。

受け入れ条件:
- UIで1000文字以上を入力できない。
- 「入力できたのに送信失敗」が発生しない。

### Step 2: レスポンス検証（Worker側）
目的: reply欠落をUIに流さない。

作業:
- apps/v2-modern/workers/routes/chat.ts
  - ChatSuccessResponseSchema を import。
  - parsedContent を safeParse。
  - 失敗時は error 応答（例: 502）または明示的 fallback を返す。

受け入れ条件:
- reply が空文字で表示されない。
- 解析失敗がログで明示される。

### Step 3: レスポンス検証（Client側）
目的: 異常応答を必ず検知して UI へ通知。

作業:
- apps/v2-modern/src/lib/api.ts
  - ChatResponseSchema を import。
  - res.json() 後に safeParse。
  - 非objectガードを追加。
  - 失敗時は例外を投げる。

受け入れ条件:
- 不正レスポンスは必ず例外化。
- useChat の catch に流れる。

### Step 4: Auth不足の明示化（Client側）
目的: 設定不足時に即時・具体的なエラーメッセージを表示。

作業:
- apps/v2-modern/src/hooks/useChat.ts
  - VITE_REQUIRE_API_TOKEN=1 かつ未設定なら送信前に例外。
  - 401時は「APIトークン未設定/不一致」メッセージに差し替え。

受け入れ条件:
- 送信前に不足が検知される。
- 401時のメッセージが具体的。

### Step 5: PDF Debugの安全性回復（DEV向け）
目的: canvas context 未取得時に落ちない。

作業:
- apps/v2-modern/src/pages/debug/PDFDebugPage.tsx
  - canvas.getContext('2d') を復活。
  - 失敗時に例外を投げ、UIでエラー表示。

受け入れ条件:
- 失敗時に画面が落ちない。
- エラー表示が出る。

## 6. 非機能要件 / UX
- エラーメッセージは具体的・行動可能にする。
  例: 「APIトークンが未設定です。VITE_API_TOKEN を設定してください。」
- replyが空の場合は必ずエラー化。

## 7. 検証方針（テストコード以外）
- 既存の npm test はそのまま実行可能。
- 手動確認:
  - VITE_REQUIRE_API_TOKEN=1 かつ未設定時に送信不可。
  - 不正応答時にエラー表示。
  - 1000文字超入力不可。
  - PDF Debug で context 失敗時にエラー表示。

## 8. リスク / ロールバック
- リスク: これまで「黙って成功」していたケースが失敗扱いになる。
- ロールバック案:
  - Workerの safeParse を緩和。
  - VITE_REQUIRE_API_TOKEN を撤回。

## 9. 追加確認が必要な事項
- API_TOKEN を本番で必須運用するか。
- VITE_REQUIRE_API_TOKEN の採用可否。
- Workerの error 返却方針（502 vs fallback reply）。

