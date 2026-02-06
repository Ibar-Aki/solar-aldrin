# iPhone SE(2/3) と iPhone 16e の機能分岐仕様（1ページ）

- 作成日時: 2026-02-07 00:11:36 +09:00
- 作成者: Codex＋GPT-5
- 対象: `v2-modern`（Web/PWA前提）
- 目的: 「現状（クラウドAI方式）」を主軸に、端末別で安全に機能ON/OFFを切り替える

## 1. 方針（結論）

- 基本方針: **現状方式（クラウドAI + オフラインキュー）を全端末で採用**
- 差分方針: 16e は音声体験を強化、SE(2/3) は安定性優先
- 非採用方針: **完全ローカルAI対話は両端末ともデフォルトOFF**

## 2. 機能ON/OFFマトリクス

| 機能 | SE(2/3) | 16e | 備考 |
| --- | --- | --- | --- |
| 基本KYチャット（クラウドAI） | ON | ON | 主機能 |
| オフラインキュー（再送同期） | ON | ON | 端末共通 |
| 手動TTS（読み上げボタン） | ON | ON | 端末共通 |
| 自動音声出力モード | ON（初期OFF） | ON（初期ON） | 既定値のみ差分 |
| 音声入力（Mic） | ON（Push-to-talk推奨） | ON（連続認識可） | SEは誤認識/電池優先 |
| 完全会話式モード（Realtimeクラウド） | ON（制限ON） | ON（フルON） | SEは自動再接続回数を低めに制限 |
| PDF生成 | ON（軽量設定） | ON（標準設定） | SEは画像品質を下げて安定化 |
| 高負荷演出（連続アニメ等） | OFF | ON | UX快適性の差分 |
| ローカルAI補助抽出（試験） | OFF | OFF（Labフラグ時のみON） | 本番既定はOFF |
| 完全ローカルAI対話 | OFF | OFF | 非採用前提 |

## 3. 判定ロジック（実装ルール）

- ルール1: 端末識別より**能力ベース判定を優先**する
- ルール2: 初期プロファイル
  - `SE(2/3) -> profile: conservative`
  - `16e -> profile: enhanced`
- ルール3: 起動時3秒以内の軽量ベンチで昇格/降格
  - UIスレッド詰まり、初回音声起動時間、メモリエラー兆候を指標化
- ルール4: 利用者が手動で「標準/軽量」を切替可能にする
- ルール5: サーバー側Remote Configで強制上書き可能にする

注記: Safari/Webでは機種名の厳密判定が難しいため、**能力ベース + 手動切替 + Remote Config**を必須とする。

## 4. 完全ローカルAIの扱い（非採用）

- 現時点は両端末でOFF固定
- 16eでも本番採用しない条件
  - p95応答がクラウド方式より悪化
  - 長時間セッションで安定性（再起動/クラッシュ）未達
  - モデル配布と更新運用の管理コストが高い
- 再検討は `Labフラグ + 16e限定 PoC` のみ

## 5. 受け入れ基準

- SE(2/3)でセッション完了率が現状比で悪化しない
- 16eで平均応答待ち体感が現状比で改善（音声導線含む）
- 端末別既定値が誤設定されても手動切替で回復できる
- 完全ローカルAI機能は本番で露出しない

## 6. 参照（公式）

- iPhone 16e 技術仕様: https://support.apple.com/122208
- iPhone SE (3rd generation) 技術仕様: https://support.apple.com/en-us/111866
- iPhone SE (2nd generation) 技術仕様: https://support.apple.com/en-ge/111882
- Apple Intelligence 対応一覧: https://www.apple.com/apple-intelligence
- Safari 26.0 のWebGPU: https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
