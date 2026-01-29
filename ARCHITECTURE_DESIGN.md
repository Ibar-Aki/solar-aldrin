# Voice KY Assistant: Architecture Design

本ドキュメントは、**Voice KY Assistant (Phase 2 Modern)** の技術アーキテクチャを定義します。

---

## 1. システム構成図 (High-Level Architecture)

**Cloudflare Workers** をBFF (Backend for Frontend) として採用し、セキュアかつ低遅延な構成を実現します。

```mermaid
graph TD
    User[現場作業員/iPhone] -->|HTTPS| CF[Cloudflare Workers<br>(BFF / Proxy)]
    
    subgraph "Frontend (PWA)"
        React[React / Vite]
        Store[Zustand Store]
        Audio[Web Speech API]
        PDF[@react-pdf]
    end
    
    subgraph "Backend Services"
        CF -->|AI Request| OpenAI[OpenAI API<br>(GPT-4o-mini)]
        CF -->|Auth/Data| D1[(Cloudflare D1<br>SQLite)]
        CF -->|Image/Log| R2[(Cloudflare R2<br>Object Storage)]
    end

    User --- React
    React -->|API Call| CF
```

---

## 2. 技術スタック (Tech Stack)

### Frontend (User Interface)

* **Framework**: React 18, Vite
* **Language**: TypeScript
* **State Management**: Zustand (軽量・フックベース)
* **Styling**: Tailwind CSS (ユーティリティファースト)
* **Speech**: Web Speech API (Browser Native) - コストゼロ、オフライン一部対応
* **PDF**: `@react-pdf/renderer` - クライアントサイド生成

### Backend (Logic & Data)

* **Runtime**: Cloudflare Workers (Edge Serverless)
* **Language**: TypeScript (Hono framework recommended)
* **Database**: Cloudflare D1 (Serverless SQLite) - KY記録の保存
* **Storage**: Cloudflare R2 - 画像データ等の保存

### AI Core

* **LLM**: OpenAI `gpt-4o-mini` - 高速・低コスト・高精度
* **Vision**: OpenAI `gpt-4o` (Phase 3以降) - 画像認識用

---

## 3. ディレクトリ構造 (Directory Structure)

Monorepo構成を採用し、フロントエンドとバックエンド（Workers）を同一リポジトリで管理します。

```text
solar-aldrin/
├── apps/
│   ├── v1-legacy/          # 旧プロトタイプ (Reference)
│   └── v2-modern/          # 本番開発環境
│       ├── src/            # Frontend Source
│       │   ├── components/ # React Components
│       │   ├── hooks/      # Custom Hooks (useChat, useAudio)
│       │   ├── stores/     # Global State (Zustand)
│       │   └── utils/      # Helpers (PDF generator etc.)
│       ├── workers/        # Backend Source (Cloudflare Workers)
│       │   ├── handlers/   # API Endpoint Logic
│       │   └── prompts/    # System Prompts for AI
│       └── docs/           # Phase 2 Specific Docs
├── PROJECT_MASTER_PLAN.md  # 全体計画
├── REQUIREMENTS_DEFINITION.md # 要件定義
└── ARCHITECTURE_DESIGN.md  # 技術設計 (This file)
```

---

## 4. データモデル (Conceptual)

主要なエンティティ設計（予定）。

### KYRecord

* `id`: UUID
* `date`: YYYY-MM-DD
* `userId`: User Identifier
* `weater`: String (晴れ/雨/気温)
* `workType`: String (足場組立/解体/etc)
* `hazards`: Array<HazardItem>
* `status`: "DRAFT" | "COMPLETED" | "SYNCED"

### HazardItem

* `situation`: どのような時 (Situation)
* `risk`: どのような危険 (Risk)
* `measure`: 対策 (Countermeasure)
* `checkAction`: 指差呼称 (Action)

---

## 5. セキュリティ設計

1. **API Key管理**: OpenAI APIキーは `wrangler.toml` (暗号化env) またはCloudflare Dashboardでのみ管理し、Gitには含めない。
2. **レート制限**: Workers側でIPベースまたはUserベースのレートリミットを設け、APIの過剰利用（DDoS/Bot）を防ぐ。
3. **入力サニタイズ**: ユーザー入力（音声テキスト化結果）は信頼せず、Workers側でバリデーションを行う。
