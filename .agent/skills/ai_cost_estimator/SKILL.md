---
name: AI Cost Estimator
description: AIモデルの変更を検討するときにコストを試算するスキル。1セッションあたりの概算費用を計算します。
---

# AI Cost Estimator Skill

AIプロバイダ・モデルの変更を検討するときに、コストを素早く試算するスキルです。
開発日誌で繰り返し行われていた「手動コスト計算」を標準化します。

> **使用タイミング**: モデル変更の議論があるとき、月次コストレビューのとき

---

## 現在のモデル設定確認

```powershell
# wrangler.toml から現在のモデル設定を確認
Select-String "DEFAULT_MODEL\|OPENAI_MODEL\|GEMINI_MODEL" apps/v2-modern/wrangler.toml

# workers コードからデフォルトモデルを確認
Select-String "gemini-|gpt-4o" apps/v2-modern/workers/routes/*.ts |
  Select-String "DEFAULT\|fallback\|model ="
```

---

## 単価テーブル（2026年2月時点）

| モデル | Input (1K tokens) | Output (1K tokens) | 特徴 |
|-------|------------------|-------------------|------|
| gpt-4o-mini | $0.00015 | $0.00060 | コスパ最高。日誌実績: 約0.60円/KY |
| gpt-4o | $0.00250 | $0.01000 | 高品質。gpt-4o-miniの35〜40倍コスト |
| gemini-2.0-flash | $0.00010 | $0.00040 | 超安価。gpt-4o-miniより安い |
| gemini-2.5-flash | $0.00015 | $0.00060 | gpt-4o-mini相当。現行デフォルト |
| gemini-1.5-pro | $0.00125 | $0.00500 | 高品質。gpt-4o-miniの8〜9倍 |

> **注**: 価格は変動します。最新価格は公式ドキュメントで確認してください。
>
> - OpenAI: <https://openai.com/pricing>
> - Google: <https://ai.google.dev/pricing>

---

## コスト試算手順

### 1. トークン数の確認（実績ログから）

```powershell
# Cloudflare Workers のメトリクスログから平均トークン数を確認
# （ローカル環境の場合）
npm run test:cost:ops
```

### 2. 概算計算式

```
1セッションあたりコスト（円）=
  ( Input tokens × Input単価 + Output tokens × Output単価 ) × 150（USD→JPY）
```

### 3. 具体例（日誌の実績値）

| シナリオ | Input | Output | gpt-4o-mini | gemini-2.5-flash |
|---------|-------|--------|-------------|-----------------|
| 通常KY（危険1件） | ~2,000 | ~800 | 約1.2円 | 約1.2円 |
| 高負荷KY（危険2件+リトライ） | ~4,000 | ~1,500 | 約2.2円 | 約2.2円 |
| 目標上限 | - | - | 5.0円 | 5.0円 |

---

## 試算結果の記録

```markdown
## YYYY-MM-DD コスト試算

- 対象モデル: XXX
- 想定シナリオ: 通常KY / 高負荷KY
- 平均Input tokens: N
- 平均Output tokens: N
- 1セッション費用: 約N円
- 月間想定（N回 × N人）: 約N円
- 判断: 採用 / 不採用 / 要検討
```
