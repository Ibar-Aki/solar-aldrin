# Phase2 Implementation Plan（MCP Sentry 自己レビュー補遺）

作成日時: 2026-02-16 01:56:11 +09:00
作成者: Codex＋v0.101.0
更新日: 2026-02-16

## 目的

Codex 起動時の `MCP startup incomplete (failed: sentry)` について、自己レビューと実費テストを行い、改善点を整理する。

## 自己レビュー結果（要点）

- 根本原因は「設定URLの陳腐化 + 認証状態不一致」。
- 旧URL (`/mcp/sentry/mcp-server?experimental=1`) では、認証済みでも `Unexpected content type: text/plain` が再現した。
- 公式ホスト系の現行URL (`https://mcp.sentry.dev/mcp`) へ合わせる必要がある。
- URL変更後は OAuth トークンの再取得（`codex mcp login sentry`）が必須。

## 実費テスト結果

| テスト | コマンド | 結果 | 判定 |
| :-- | :-- | :-- | :-- |
| T1 | `codex exec ...`（旧URL設定） | `Unexpected content type: text/plain;charset=UTF-8` | NG |
| T2 | `codex exec ... -c 'mcp_servers.sentry.url="https://mcp.sentry.dev/mcp"'` | `The sentry MCP server is not logged in` | 想定通り（再ログイン未実施） |
| T3 | `codex mcp list`（URL更新後） | `sentry ... Auth: Not logged in` | 再ログイン必要 |
| T4 | `codex exec ...`（URL更新後） | `sentry failed: not logged in` が再現 | 想定通り |

## 修正対応（確度高・実施済み）

1. `C:\Users\AKIHIRO\.codex\config.toml` の `sentry` URL を `https://mcp.sentry.dev/mcp` に変更。
2. 同ファイルのコメントを現行運用に合わせて更新（URL変更時は再ログイン必要を明記）。

## 判断に迷う改善（表化のみ）

| 改善候補 | 期待効果 | 懸念/トレードオフ | 現時点判断 |
| :-- | :-- | :-- | :-- |
| `sentry` を常時有効ではなく必要時のみ有効化 | 起動時ノイズ削減、障害時の影響局所化 | 利用時に都度有効化が必要 | 保留 |
| `startup_timeout_sec` を 30→60 に延長 | 一時的ネットワーク遅延での誤検知低減 | 失敗検知が遅くなる | 保留 |
| 起動前チェック（`codex mcp list` + auth判定）をスクリプト化 | 障害の事前検出、自動復旧導線 | 運用コスト増 | 保留 |

## 残作業（ユーザー操作が必要）

- `codex mcp login sentry` を実行し、表示される OAuth URL をブラウザで開いて認証完了する。
- 認証後、`codex exec` を1回実行し、`mcp startup: ... failed: sentry` が消えることを確認する。
