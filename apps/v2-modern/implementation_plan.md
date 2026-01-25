# Phase 2: Voice KY Assistant v2 (Modern) Implementation Plan

**目的**: ユーザー体験（ハンズフリー・モダンUI）と開発効率（React・TS）を両立した、次世代KYアプリの構築。

## 📋 要件定義サマリー (User Requirements)

1. **Tech Stack**: Vite + React + TypeScript + Hono (User Approved)
2. **Auth**: **ハイブリッド認証**（誰でも利用可 + 任意でログインして履歴保存）
3. **Audio**: **ハンズフリー**（常時待機・自動認識）を目指す
4. **Database**: **Supabase** (Free Tier優先 / 開発容易性)
5. **UI/Design**: 白基調・シンプルかつモダン (Tailwind CSS)。ダークモードなし。
6. **Cost**: 1回5円以下（GPT-4o mini採用で達成を狙う）
7. **Migration**: v1データ移行不要。v1とは別URLで並行稼働。

---

## 🏗️ アーキテクチャ設計

### 1. フロントエンド (`apps/v2-modern/client`)

- **Framework**: React 18+ (via Vite)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (Shadcn/ui 採用で「モダンな白基調」を安価に実現)
- **State**: Zustand (軽量ステート管理)
- **Audio**: Web Speech API wrapper (自動再起動ロジック実装)

### 2. バックエンド (`apps/v2-modern/server`)

- **Runtime**: Cloudflare Workers
- **Framework**: Hono (軽量・型安全)
- **AI**: OpenAI API (GPT-4o mini)
- **DB**: Supabase (PostgreSQL via REST API)

### 3. デプロイ

- **Cloudflare Pages**: フロントエンドとバックエンド(Functions)を統合ホスティング。
- **URL**: `v2-preview.voice-ky-assistant.pages.dev` (仮)

---

## 💡 重要機能の実装アプローチ

### 0. 前提・制約（必ず明記）

- **常時待機の限界**: ブラウザ/OS制約により「完全な常時待機」は不可（画面OFFやバックグラウンドで停止）。
- **対応ブラウザ**: Web Speech APIは主にChromium系で安定。非対応環境は**プッシュトゥトーク**や**テキスト入力**へフォールバック。
- **ユーザー操作必須**: 初回はユーザー操作でマイク開始が必須。権限拒否時の再導線を用意。

### 1. ハンズフリー音声操作 (Hands-free)

Web Speech APIの仕様（無音で停止、iOSでの制限）を回避するため、以下の段階的実装を行います。

- **Step 1（基本）**: `continuous: true` + `onend` イベントでの自動再開ループ。
  - これにより「聞き続ける」挙動を擬似的に再現。
  - システム発話中（TTS）は認識を一時停止する制御を入れる（自分自身の声を拾わないように）。
  - `visibilitychange` / `pagehide` での停止・復帰、エラー時の再試行間隔も設計。
- **Step 2（高度・将来）**: これで不十分な場合、`AudioWorklet` + `VAD (Voice Activity Detection)` ライブラリの導入を検討。

### 2. コスト管理 (Cost Strategy)

「1回5円以下」を厳守するため、**GPT-4o mini** を標準採用します。

- **試算方針**:
  - 価格は変動するため、**実装前に公式価格で再計算**する。
  - 1回あたりの想定トークン（例: 5往復で10k tokens）を前提に、上限トークン・最大応答長を設ける。
  - 目標: **1回5円以下**を維持できる上限設計。

### 3. ハイブリッド認証

* **ゲストユーザー**: `localStorage` でID保持は可。ただし**DBアクセスはサーバー経由**に限定し、署名付きセッションで保護（推測可能なUUID単体の直アクセスは避ける）。
- **ログインユーザー**: Supabase Auth でログインし、`user_id` でDBと紐付け。

---

## 🔐 非機能・セキュリティ

- **キー管理**: OpenAI / Supabaseの秘匿キーはCloudflare環境変数に限定。フロントに露出させない。
- **RLS/権限**: ログインユーザーはRLS必須。ゲストはサーバー経由のみ。
- **レート制限**: ゲストはIP/セッション単位の制限を追加（濫用対策）。

---

## 📅 開発ステップ (Step-by-Step)

### Step 1: プロジェクトセットアップ

- [ ] `apps/v2-modern` に Vite + React + Hono 環境構築
- [ ] Tailwind CSS + Shadcn/ui 導入
- [ ] Hello World デプロイ (Cloudflare Pages)

### Step 2: コア機能移植 & ハンズフリー実装

- [ ] Web Speech API ラッパー実装（自動再開ロジック）
- [ ] Hono バックエンドでの OpenAI API 接続
- [ ] チャットUI実装
- [ ] TTS再生（SpeechSynthesis もしくは外部TTS）とミュート制御
- [ ] 非対応ブラウザ向けフォールバックUI（プッシュトゥトーク / テキスト）

### Step 3: DB接続 & 認証

- [ ] Supabase プロジェクト作成（またはv1用を流用しテーブル分離）
- [ ] DBスキーマ設計（`v2_*` テーブル、必要インデックス）
- [ ] RLS/権限設計（ログインユーザー）
- [ ] ゲスト用API（サーバー経由）とセッション保護

### Step 4: 仕上げ

- [ ] PDF生成（今回は `react-pdf` 等のモダンライブラリ検討）
- [ ] UIブラッシュアップ
- [ ] 主要ブラウザでの動作検証（Chromium系 + iOSはフォールバック確認）
- [ ] コスト/レート制限の挙動確認

---

## ⚠️ 確認事項

- v1で使用中のSupabaseプロジェクトをそのまま使いますか？（テーブル名 `v2_records` などで分ければ共存可能です）
  - **推奨**: 無料枠範囲内なら共存が手軽です。
