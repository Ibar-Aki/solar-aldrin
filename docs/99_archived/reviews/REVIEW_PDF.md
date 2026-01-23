# PDF機能レビュー報告

- 対象: `src/public/js/screens/done.js`
- 実施日: 2026-01-23
- 方式: 静的コードレビュー（実機/ブラウザ動作確認なし）

## サマリー

- 重大: 0
- 高: 1
- 中: 2
- 低: 2

## 指摘事項 (※2026-01-24 v1にて全件対応済み)

### 高

1) `window.open` がユーザー操作の同期コンテキスト外で呼ばれており、ポップアップブロックされる可能性  
   - 位置: `apps/v1-legacy/src/public/js/screens/done.js`  
   - 内容: `generatePDF()` 内でライブラリロード/描画などの `await` 後に `window.open()` を呼んでいるため、ブラウザによっては「ユーザー操作に紐づかない」と判定されて新しいタブが開かない。  
   - 影響: PDFが表示されず、ユーザーから「何も起きない」状態に見える。  
   - 参考対応: クリック直後に空ウィンドウを開き後から `location` を設定、または `doc.save()` 等で直接ダウンロードに切り替える。

### 中

2) 長文時にPDFが1ページに収まりきらず、末尾が欠ける  
   - 位置: `src/public/js/screens/done.js:122-125`  
   - 内容: 1枚の画像として `addImage` しているため、`imgHeight` がA4縦サイズを超えると下部が切れる。  
   - 影響: 危険/対策の項目が多いとPDFに欠落が発生。  
   - 参考対応: 画像をページ分割して複数ページに追加するか、縮小比率を調整。

2) オフライン/低速時に外部CDN読み込みが失敗しPDF生成不能  
   - 位置: `src/public/js/screens/done.js:141-155`  
   - 内容: html2canvas/jsPDF をCDN動的ロードしており、PWAのオフライン前提と相性が悪い。  
   - 影響: 電波状況が悪い現場でPDFが生成できない。  
   - 参考対応: ライブラリをローカル同梱し、SWでキャッシュ。

### 低

4) `URL.createObjectURL` の解放漏れ  
   - 位置: `src/public/js/screens/done.js:128-130`  
   - 内容: 生成したBlob URLを `URL.revokeObjectURL()` していない。  
   - 影響: 長時間利用で軽微なメモリリーク。  
   - 参考対応: `window.open` の後に `setTimeout` で解放。

2) `hazards` / `countermeasures` が配列でない場合に例外  
   - 位置: `src/public/js/screens/done.js:79-86`  
   - 内容: `map()` 前提で配列扱いしているため、想定外のAPI応答や状態破損時にクラッシュする。  
   - 影響: PDF生成が失敗する可能性。  
   - 参考対応: `Array.isArray` でガード。

## 未確認/テストギャップ

- iOS Safari/PWA での `window.open` 挙動（特にBlob URL）  
- 長文（危険/対策が10件以上）のPDF出力  
- オフライン時のPDF生成
