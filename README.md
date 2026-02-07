# Solar Aldrin: Voice KY Assistant

更新日: 2026-02-07

**「話すだけで、質の高い危険予知が完了する」**
**「二度書きの無駄をなくし、現場の知恵をつなぐ」**

建設現場の危険予知（KY）活動をAIで変革する「AIファシリ型KYシステム」のMonorepoです。

## 📍 Project Overview

音声対話によってKY活動をファシリテートし、入力負荷の削減だけでなく「思考の深化」と「マンネリ化防止」を実現します。

詳細は以下のコア・ドキュメントを参照してください：

- **[Project Master Plan](./PROJECT_MASTER_PLAN.md)**: プロジェクト全体のビジョン、ロードマップ、ROI定義
- **[Requirements Definition](./REQUIREMENTS_DEFINITION.md)**: 機能要件、業務フロー、データ要件
- **[Architecture Design](./ARCHITECTURE_DESIGN.md)**: 技術設計、システム構成

## 🗺️ Roadmap & App Status

プロジェクトは4つのフェーズで構成されています。

### [Phase 1: v1-legacy](./apps/v1-legacy/)

- **Status**: 凍結 (Archived)
- **Target**: 実現可能性検証
- **Code**: [`./apps/v1-legacy/`](./apps/v1-legacy/)
- **Tech**: GAS, Vanilla JS
- **[Documentation](./apps/v1-legacy/docs/)**: Phase 1 時代の企画書、設計書アーカイブ

### [Phase 2: v2-modern (Current)](./apps/v2-modern/)

- **Status**: **開発中 (Active Development)**
- **Target**: ソロKYの定着、安定稼働、PDF自動生成
- **Code**: [`./apps/v2-modern/`](./apps/v2-modern/)
- **Tech**: React, Vite, Cloudflare Workers, OpenAI, IndexedDB (local)
  - ※D1（サーバーDB）はPhase 3以降で導入予定
- **[Documentation](./apps/v2-modern/docs/)**: 要件定義、詳細設計、API仕様書など

### Phase 3-4: Future Expansion

- **Status**: 計画中 (Planned)
- **Target**:
  - **Phase 3**: 他社KY取り込み（OCR）、画像診断
  - **Phase 4**: チームKY、組織分析ダッシュボード

## 📚 Quick Links

- [Phase 2 Setup Guide](./apps/v2-modern/docs/PHASE2_SETUP.md)
- Development Diary (開発日誌): リポジトリ外（ローカル管理のためリンクは掲載しません）
