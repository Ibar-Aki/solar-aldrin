# AIファシリ型KYシステム タスク管理

## 現在のフェーズ: PLANNING → 承認待ち

---

## タスク一覧

### 企画・要件定義フェーズ ✅

- [x] KY活動表サンプル作成
- [x] 初版企画書作成
- [x] 初版要件定義書作成
- [x] ヒアリング実施（23項目）
- [x] 基本機能案の検討 → 案B（AIファシリテート型）に決定
- [x] 企画書・要件定義書のブラッシュアップ
  - [x] レビュー指摘（監査・プライバシー・技術）への対応
  - [x] 徹底批判検証とレポート作成（批判・回答・深掘り）
  - [x] リポジトリ全体のブラッシュアップ（構成・命名・内容）
- [/] ユーザーレビュー・承認

### 設計フェーズ（進行中）

- [x] 詳細設計書作成
- [x] UI/UXデザインモックアップ作成（docs/planning/ui_ux_design.md）
- [x] AI対話フロー詳細設計（docs/planning/ai_dialogue_design.md）
- [x] 技術検証計画（docs/planning/speech_test_plan.md）

### 実装フェーズ（進行中）

- [x] プロジェクトセットアップ
  - [x] ディレクトリ構成作成
  - [x] PWA基盤（manifest.json, sw.js）
  - [x] index.html + 基本CSS
- [x] フロントエンド実装
  - [x] 状態管理（state.js）
  - [x] 画面遷移（router.js）
  - [x] ホーム画面（home.js）
  - [x] 対話画面（chat.js）
  - [x] 確認画面（confirm.js）
  - [x] 完了画面（done.js）
  - [x] 履歴画面（history.js）
- [x] 音声モジュール実装
  - [x] 音声認識（speech.js）
  - [x] 音声合成（tts）
- [x] API連携
  - [x] API通信モジュール（api.js）
  - [x] ローカルストレージ（storage.js）
- [x] PDF生成
  - [x] pdf.js実装（done.js内）
- [x] バックエンド実装
  - [x] Cloudflare Workers設定
  - [x] /api/chat エンドポイント
  - [x] /api/advice エンドポイント
  - [x] /api/weather エンドポイント
  - [x] /api/records エンドポイント
  - [x] /api/sync エンドポイント
- [ ] テスト・検証
  - [x] 動作確認
  - [x] コードレビュー修正（Supabase, 現場名, PDF）
  - [x] 自己徹底レビューと修正（UI/UX, SW, エラー処理）
  - [ ] パイロット運用
- [x] ドキュメント整備
  - [x] 利用者ガイド作成（docs/user_guide.md）
  - [x] 実装詳細ドキュメント作成（docs/technical_spec.md）
- [x] 将来像検討
  - [x] 完全ハンズフリー化の技術的検討（docs/planning/future_handsfree.md）

---

## ヒアリング結果サマリー

| 項目 | 内容 |
|------|------|
| 目的 | 自社利用、KYの質向上 |
| 予算 | 月3000円、1回10円許容 |
| 開発 | 自分、制約なし |
| 利用 | 一人KY、朝・昼の2回 |
| ユーザー | iPhone SE、スマホ不慣れ、認証不要 |
| 課題 | 書くのも考えるのも苦手 |
| 成功基準 | KYの質が上がる |
| 選定案 | 案B → 将来案Cへ拡張 |
