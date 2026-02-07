# AI応答時間短縮ガイド（v2-modern）

- 作成日: 2026-02-03
- 作成者: Codex + GPT-5
- 更新日: 2026-02-03

---

## 目的

AIの応答時間を短縮し、テスト（`real-cost`）での平均応答時間を安定して目標内に収めるための、実践的な改善策を整理する。

---

## 応答時間が遅くなる主因

1. **入力トークンの増大**
2. **システムプロンプトの肥大化**
3. **コンテキスト注入の肥大化**
4. **出力トークン上限が高い**
5. **会話ターン数の増加**
6. **モデル側の混雑・レイテンシ**

---

## 計測の基準（何を見れば速くなったと言えるか）

主に `reports/real-cost-*.md` の以下指標を使う。

| 指標 | 意味 | 目安 |
|---|---|---|
| **Avg AI Response** | 1ターンあたりのAI応答時間 | 5.0s以下 |
| **Total Duration** | テスト全体の所要時間 | 120s以下 |
| **Conversation Turns** | 会話の往復回数 | 3〜5 |
| **Errors (AI/System)** | AI/システムのエラー数 | 0 |

---

## すぐ効く改善（優先度順）

1. **会話履歴の上限を下げる**  
`apps/v2-modern/workers/routes/chat.ts` の `MAX_HISTORY_TURNS` を 10 → 6 などに調整。  
入力トークンが大きく減りやすい。

2. **出力トークン上限を下げる**  
同ファイルの `MAX_TOKENS` を 1000 → 600 程度に調整。  
JSON応答のため大幅な影響は出にくいが安定して短縮できる。

3. **コンテキスト注入の上限を短くする**  
`apps/v2-modern/src/lib/contextUtils.ts` の `injection.slice(0, 1200)` を 600〜800 に変更。  
`apps/v2-modern/src/lib/schema.ts` の `contextInjection` 最大長も同時に下げる。

4. **システムプロンプトを圧縮する**  
`apps/v2-modern/workers/prompts/soloKY.ts` の説明・例・冗長な指示を削る。  
会話の品質と引き換えに大きな短縮が見込める。

5. **コンテキスト注入を初回のみ送る**  
`apps/v2-modern/src/hooks/useChat.ts` で「最初の1〜2ターンのみ `contextInjection` を送る」運用。  
初回以降のターンが軽くなる。

6. **温度を下げる**  
`apps/v2-modern/workers/routes/chat.ts` の `temperature: 0.7 → 0.4`。  
応答が短く安定しやすい。

---

## 変更ポイント一覧（コード参照）

| 対象 | ファイル | 変更例 |
|---|---|---|
| 会話履歴数 | `apps/v2-modern/workers/routes/chat.ts` | `MAX_HISTORY_TURNS = 6` |
| 最大出力 | `apps/v2-modern/workers/routes/chat.ts` | `MAX_TOKENS = 600` |
| コンテキスト注入上限 | `apps/v2-modern/src/lib/contextUtils.ts` | `slice(0, 600)` |
| リクエスト上限 | `apps/v2-modern/src/lib/schema.ts` | `contextInjection: z.string().max(600)` |
| システムプロンプト | `apps/v2-modern/workers/prompts/soloKY.ts` | 文章圧縮 |
| 注入タイミング | `apps/v2-modern/src/hooks/useChat.ts` | 初回限定化 |

---

## 具体的な短縮ガイド

1. **会話履歴を削る**  
履歴を減らすほど入力が小さくなり、応答が速くなる。  
`MAX_HISTORY_TURNS` を 6 まで下げても、通常のKYフローは維持可能。

2. **システムプロンプトを“短いが強い指示”に置き換える**  
「長い説明」より「短い強制ルール」を優先する。  
例: 例示・補足説明は削除し、CRITICALルールだけ残す。

3. **コンテキスト注入は“1回・短く・要点のみ”**  
直近リスク・過去リスク・ヒヤリハット・天候/曜日の全部を毎回入れるのは重い。  
最初のターンだけ注入し、以降は省略すると効果が高い。

4. **返答の最大長を制限する**  
JSON応答は長文不要。  
`MAX_TOKENS` を下げても、短文＋質問1つのスタイルなら支障が少ない。

---

## 実施手順（おすすめ手順）

1. **現状のベースライン計測**

```bash
npm run test:cost
```

2. **優先度1〜3の変更を適用**  
`MAX_HISTORY_TURNS`、`MAX_TOKENS`、`contextInjection` 上限を調整。

3. **再計測**

```bash
npm run test:cost
```

4. **結果比較**  
`reports/real-cost-*.md` の `Avg AI Response` を比較する。

---

## トレードオフ（短縮の副作用）

| 施策 | 良い影響 | 悪い影響 |
|---|---|---|
| 履歴削減 | 速くなる | 文脈不足で会話品質が落ちる可能性 |
| プロンプト圧縮 | 速くなる | ルール逸脱が起きやすい |
| 注入短縮 | 速くなる | 過去リスク参照が減る |
| 出力制限 | 速くなる | 返答が途切れる可能性 |

---

## 次にやるなら

1. まず **履歴削減 + 出力上限 + 注入上限** の3点を実施
2. 結果が足りなければ **プロンプト圧縮** を追加
3. それでも遅い場合は **注入の初回限定** を検討
