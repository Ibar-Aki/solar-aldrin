# v2-modern 徹底辛口レビュー

更新日: 2026-02-07（ファイル整理：配置/ファイル名変更）

## 指摘
- **[高] レート制限が常にメモリ版で、本番でも分散環境で無効化に近い（コスト爆発リスク）**  
  `workers/index.ts:4` `workers/index.ts:48` `workers/middleware/rateLimit.ts:68`
- **[高] クライアントが`system`ロールを送れてしまい、プロンプト注入で挙動が崩れる**  
  `workers/routes/chat.ts:12` `workers/routes/chat.ts:88`
- **[高] 入力長制限が「最後のメッセージのみ」。過去メッセージや`/extract`の`conversation`は無制限でDoS/コスト増の温床**  
  `workers/routes/chat.ts:59` `workers/routes/chat.ts:145`
- **[中] PDFフォントの登録先が存在せず、生成時に失敗/文字化けの可能性**  
  `src/components/pdf/KYSheetPDF.tsx:8` `public/fonts`
- **[中] 無音/非表示停止が`autoRestart`を潰し、ハンズフリー前提を満たしにくい**  
  `src/hooks/useVoiceRecognition.ts:54` `src/hooks/useVoiceRecognition.ts:136`
- **[中] レート制限の窓がKV版とメモリ版で挙動不一致（KVはリクエストごとに延長）**  
  `workers/middleware/rateLimit.ts:50` `workers/middleware/rateLimit.ts:84`
- **[中] PDFファイル名に現場名を直埋め込み。禁止文字でダウンロード失敗の恐れ**  
  `src/hooks/usePDFGenerator.tsx:31`
- **[低] レンダー中に`navigate`を実行しており、StrictModeで警告/二重遷移の原因**  
  `src/pages/CompletionPage.tsx:19`
- **[低] 未使用コードが散在（保守負債）**  
  `src/stores/appStore.ts:1` `src/hooks/useTTS.ts:1` `src/components/MicButton.tsx:1` `src/lib/validation.ts:1` `src/App.css:1`

## 確認事項 / 質問
- 本番でもレート制限を有効化する前提で良いですか？（KVバインド追加・`rateLimit`切替）
- `system`ロールはサーバーのみが付与、クライアントは`user/assistant`限定で良いですか？
- PDF出力を必須機能にするならフォントを同梱しますか？

## テスト/検証ギャップ
- Workers APIの負荷/悪用シナリオ（巨大入力・連打）とPDF生成の実機検証が未実施です。

## 次の一手（提案）
1. レート制限をKVベースに統一し、挙動も固定窓/スライド窓どちらかに揃える
2. API入力のロール/サイズ検証を追加してプロンプト注入とコストを抑止
3. PDFフォント同梱＋ファイル名サニタイズ、不要な未使用コード整理

