# Voice KY Assistant: Project Master Plan

**「話すだけで、質の高いKYが完了する」**

Voice KY Assistant は、建設現場における形骸化した危険予知活動（KY活動）を、音声AIアシスタントを通じて変革するプロジェクトです。
本ドキュメントは、フェーズを跨いだ**プロジェクト全体のビジョンと軌跡**を管理します。

## 1. プロジェクト憲章

### ビジョン (Vision)

現場作業員が「書く負担」から解放され、AIとの対話を通じて「本質的な危険」に気づけるようになること。

### 成功基準 (Success Criteria)

1. **KYの質向上**: 具体的な危険要因と対策が言語化されること。
2. **継続率**: 作業員が「これなら毎日使える」と感じること。
3. **法令遵守**: デジタル完結しつつ、監査に耐えうる記録を残せること。

## 2. フェーズ別戦略 (Phase Strategy)

| フェーズ | 呼称 | 対象期間 | テーマ | 技術スタック | ステータス |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Phase 1** | Legacy | 2026/01 Initial | **MVP検証**<br>音声認識×OpenAIの実用性確認 | GAS, Vanilla JS | 🛑 完了/凍結 |
| **Phase 2** | Modern | 2026/01 - Present | **モダン化・UX強化**<br>React導入、レスポンス高速化 | React, Vite, Workers | 🚀 **開発中** |
| **Phase 3** | Data | Future | **データ活用**<br>分析ダッシュボード、組織展開 | Supabase, Vector DB | 📅 計画中 |

## 3. 要件実装状況 (Implementation Status)

詳細な要件は [Global Requirements](./Global_REQUIREMENTS.md) を参照してください。

| コア機能 | Phase 1 (Legacy) 対応 | Phase 2 (Modern) 対応 |
| :--- | :--- | :--- |
| **音声対話** | ❌ ブラウザ基本機能のみ<br>(UX不安定) | ✅ **専用UI (MicButton)**<br>(フィラー演出, 手袋モード) |
| **KYロジック** | ⚠️ OpenAI直打ち<br>(制御困難) | ✅ **構造化プロンプト**<br>(危険要因の深掘り強化) |
| **PDF生成** | ⚠️ pdf-lib (クライアント負荷高) | ✅ **@react-pdf/renderer**<br>(高速・安定) |
| **セキュリティ**| ❌ APIキー露出リスク | ✅ **Cloudflare Workers**<br>(キー隠蔽, レート制限) |

## 4. ドキュメント体系

本プロジェクトのドキュメントは、以下の構造で管理されています。

- **Root (ここ)**: 全体方針 (`Global_REQUIREMENTS.md` 等)
- **[apps/v2-modern/docs](apps/v2-modern/docs)**: Phase 2 詳細設計・手順書 **(現在の正本)**
- **[apps/v1-legacy/docs](apps/v1-legacy/docs)**: Phase 1 アーカイブ資料
