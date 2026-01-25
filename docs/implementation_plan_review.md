# 実装計画レビュー（Voice KY Assistant v2）

**指摘事項**
- [Critical] OpenAI 連携の認証・レート制限・CORS・APIキー管理の方針が明記されていないため、公開APIが濫用されるとコスト暴騰や不正利用につながります。少なくともWorkers側で鍵を保持し、オリジン制限とレート制限を計画に組み込むべきです。`C:\Users\AKIHIRO\.gemini\antigravity\brain\5d4bcf58-082d-4703-97c2-56ff62185063\implementation_plan.md:110` `C:\Users\AKIHIRO\.gemini\antigravity\brain\5d4bcf58-082d-4703-97c2-56ff62185063\implementation_plan.md:141`
- [High] 音声認識を常時リスニング前提で設計していますが、iOS Safariの音声認識は非対応または制限が大きく、計画の主要ブラウザ要件と矛盾します。コア機能が成立しない可能性が高いので、最初から「テキスト主導＋音声は補助」の段階的導入が必要です。`C:\Users\AKIHIRO\.gemini\antigravity\brain\5d4bcf58-082d-4703-97c2-56ff62185063\implementation_plan.md:82` `C:\Users\AKIHIRO\.gemini\antigravity\brain\5d4bcf58-082d-4703-97c2-56ff62185063\implementation_plan.md:232`
- [High] データモデルの必須項目（指差し確認、ヒヤリハット、全対策実施など）に対する入力フローやUIが計画に含まれておらず、セッションが完了できない／型的に不整合になる懸念があります。段階的入力に合わせて optional 化やサブフロー追加が必要です。`C:\Users\AKIHIRO\.gemini\antigravity\brain\5d4bcf58-082d-4703-97c2-56ff62185063\implementation_plan.md:58` `C:\Users\AKIHIRO\.gemini\antigravity\brain\5d4bcf58-082d-4703-97c2-56ff62185063\implementation_plan.md:128`
- [High] 「会話区切りでJSON返却」前提ですが、モデル出力の揺らぎや破損に対する検証・回復策がありません。JSONパース失敗時のリトライやサニタイズ、厳格バリデーションがないと状態破壊につながります。`C:\Users\AKIHIRO\.gemini\antigravity\brain\5d4bcf58-082d-4703-97c2-56ff62185063\implementation_plan.md:122` `C:\Users\AKIHIRO\.gemini\antigravity\brain\5d4bcf58-082d-4703-97c2-56ff62185063\implementation_plan.md:141`
- [Medium] PDF生成のライブラリ選定が混在しており、Workers上でのサーバー生成可否や日本語フォント埋め込みの重さが未検証です。クライアント生成に寄せるのか、サーバー生成に寄せるのかを先に決めないと実装が揺れます。`C:\Users\AKIHIRO\.gemini\antigravity\brain\5d4bcf58-082d-4703-97c2-56ff62185063\implementation_plan.md:204`
- [Medium] コスト試算が「2024年時点」であり、また計算結果の整合性が不明確です。運用に入る前に最新料金と実測トークンの両方で再計算する必要があります。`C:\Users\AKIHIRO\.gemini\antigravity\brain\5d4bcf58-082d-4703-97c2-56ff62185063\implementation_plan.md:295`
- [Medium] 音声認識は「常時リスニング＋自動再開」だけだとバッテリー消費・誤認識・TTSエコーが増えます。VADや一定時間無入力での停止、TTS中のハードミュートなど実装詳細が必要です。`C:\Users\AKIHIRO\.gemini\antigravity\brain\5d4bcf58-082d-4703-97c2-56ff62185063\implementation_plan.md:96`
- [Medium] 実装順序が音声→AI→UIの順になっており、デバッグ難易度が高いです。まずテキストUI＋手入力で会話フローとJSON抽出を固め、その後に音声を載せる方が合理的です。`C:\Users\AKIHIRO\.gemini\antigravity\brain\5d4bcf58-082d-4703-97c2-56ff62185063\implementation_plan.md:82`
- [Medium] 検証計画が手動中心で、パーサ/ストア/API境界の自動テストが想定されていません。モデル出力の揺らぎや回帰に備えるため、最低限のユニット/契約テストが必要です。`C:\Users\AKIHIRO\.gemini\antigravity\brain\5d4bcf58-082d-4703-97c2-56ff62185063\implementation_plan.md:314`
- [Low] `WorkItem.id` が `number` 必須で、セッション間での一意性や並び替えに弱いです。`uuid` などの衝突しにくいIDにしておくと後工程が安定します。`C:\Users\AKIHIRO\.gemini\antigravity\brain\5d4bcf58-082d-4703-97c2-56ff62185063\implementation_plan.md:49`
- [Low] 時刻・日付フィールドが文字列のみで形式指定がなく、タイムゾーンや表示揺れが起きやすいです。ISO 8601等の規約を明記した方が後で困りません。`C:\Users\AKIHIRO\.gemini\antigravity\brain\5d4bcf58-082d-4703-97c2-56ff62185063\implementation_plan.md:64`

**確認事項**
- 天気・気温はユーザー手入力ですか、それとも外部API取得ですか。`C:\Users\AKIHIRO\.gemini\antigravity\brain\5d4bcf58-082d-4703-97c2-56ff62185063\implementation_plan.md:60`
- セッション履歴の保存先はローカル永続のみですか。将来的にSupabaseへ同期する想定はありますか。`C:\Users\AKIHIRO\.gemini\antigravity\brain\5d4bcf58-082d-4703-97c2-56ff62185063\implementation_plan.md:26`
- 送信されるデータ（現場名・ヒヤリハット等）の取り扱いについて、利用者同意や社内規定との整合は必要ですか。`C:\Users\AKIHIRO\.gemini\antigravity\brain\5d4bcf58-082d-4703-97c2-56ff62185063\implementation_plan.md:58`

**変更提案の要約**
- API保護（CORS/レート制限/キー管理）をStep 3に追加し、公開運用の前提を明文化する。
- 会話フローに合わせてデータモデルを段階的入力前提にし、未確定フィールドは optional にする。
- JSON抽出の検証・回復設計を入れ、壊れた出力がストアを破壊しないようにする。
- 実装順序を「テキストUI→AI→音声」に変更し、基礎フローを先に安定化する。
- PDF生成方式とフォント方針を早期に確定し、Workers実行可否を検証する。
