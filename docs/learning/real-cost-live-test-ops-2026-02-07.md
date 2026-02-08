# Real-Cost 実費テスト運用メモ（v2-modern）

- 作成日時: 2026-02-07 01:15:00 +09:00
- 作成者: Codex＋GPT-5
- 更新日: 2026-02-07

## 目的

- 実費（LIVE）E2Eの実行手順を「コマンド1本」に近づけ、失敗時の原因特定を速くする。
- レポートと性能推移を同じ場所に残し、日次で比較できる状態にする。

## 実行手順（最小）

```bash
cd apps/v2-modern
npm run test:cost:ops
```

- `test:cost:ops` は以下を順に実行する:
- `test:cost:preflight`（API疎通チェック）
- `test:cost:live`（Mobile Safari の実費E2E）
- `reports:perf`（日次サマリ再生成）

## レポート保存先（表示履歴）

- 実費レポート: `apps/v2-modern/reports/real-cost/LIVE/`
- スクリーンショット: `apps/v2-modern/reports/real-cost/LIVE/`（`final-result-*.png`）
- Playwright HTML: `apps/v2-modern/playwright-report/index.html`
- 失敗時DOMスナップショット: `apps/v2-modern/test-results/**/error-context.md`

## 履歴整理（任意）

日付ごとに最新1件だけ残す（LIVE/DRY-RUN/test 各モード単位）。

```bash
cd apps/v2-modern
npm run reports:prune
```

- 実行ログ: `apps/v2-modern/reports/real-cost/prune-log-YYYY-MM-DD.md`

## 最新結果（記録）

- 最新 PASS レポート:
- `apps/v2-modern/reports/real-cost/LIVE/real-cost-LIVE-2026-02-06T16-08-21-301Z.md`
- 指標:
- Total Duration: 104.6s
- Avg AI Response: 7.9s
- Errors: 0

## 性能推移（参照）

- 日次サマリ: `apps/v2-modern/reports/perf/daily-summary-YYYY-MM-DD.md`
- 例:
- `apps/v2-modern/reports/perf/daily-summary-2026-02-06.md`
- `apps/v2-modern/reports/perf/daily-summary-2026-02-03.md`

