# React PDF Renderer 帳票出力 Tips

`apps/v2-modern` では、KY活動記録のPDF出力に `@react-pdf/renderer` を使用しています。
Web標準のCSSとは異なる独自のレイアウトエンジンを使用するため、いくつかの注意点があります。

## 1. 日本語フォントの設定

デフォルトでは日本語が表示されない（文字化けする）ため、TTFファイルを読み込んで登録する必要があります。

### 実装例: `components/pdf/KYSheetPDF.tsx`

```tsx
import { Font } from '@react-pdf/renderer'

// アプリケーション起動時やコンポーネント外で登録
Font.register({
    family: 'NotoSansJP',
    src: '/fonts/Noto_Sans_JP/static/NotoSansJP-Regular.ttf', 
    // ※Viteのpublicフォルダからのパスを指定
})

// スタイルで使用
const styles = StyleSheet.create({
    page: {
        fontFamily: 'NotoSansJP', // ここで指定
        fontSize: 10,
    }
})
```

## 2. レイアウトの基本

Flexboxレイアウトが基本ですが、WebのCSSと同様に使えないプロパティも多いです。

* **`View` と `Text`**: 基本的な構成要素。`div` と `span/p` に相当。
* **`styles` オブジェクト**: 文字列ではなくオブジェクトでスタイルを定義する。
* **色の指定**: 16進数コード（`#ffffff`）などが安全。CSS変数（`var(--color...)`）は使えない。

```tsx
const styles = StyleSheet.create({
    header: {
        flexDirection: 'row', // 横並び
        justifyContent: 'space-between',
        borderBottom: '2px solid #2563eb', // ボーダー指定
        marginBottom: 15,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold', // 日本語フォントによっては効かない場合あり（太字フォントファイルの別途登録が必要）
    }
})
```

## 3. 実践テクニック

### リスト表示（箇条書き）

HTMLの `<ul>`, `<li>` は存在しないため、Flexboxで自作します。

```tsx
<View style={styles.listItem}>
    <Text style={styles.bullet}>•</Text>
    <Text>{item.content}</Text>
</View>
```

### チェックボックス（四角形）

画像を使わず、`View` のボーダーで描画すると綺麗に出力されます。

```tsx
<View style={{
    width: 12,
    height: 12,
    border: '1px solid #000',
    justifyContent: 'center',
    alignItems: 'center'
}}>
    <Text>{checked ? '✓' : ''}</Text>
</View>
```

### 動的な要素のレンダリング

Reactコンポーネントなので、Array.map や条件分岐 (`&&`) がそのまま使えます。

```tsx
{/* 環境リスクがある場合のみ表示 */}
{session.environmentRisk && (
    <View style={styles.environmentRisk}>
        <Text>⚠️ {session.environmentRisk}</Text>
    </View>
)}
```

## ハマりどころ

* **フォントファイル**: 太字（Bold）を使いたい場合、`fontWeight: 'bold'` を指定するだけでなく、対応するフォントファイル（例: `NotoSansJP-Bold.ttf`）を別途登録し、`fontWeight` プロパティと共に `Font.register` する必要があります。現状の `KYSheetPDF.tsx` では Regular のみ登録しているため、太字指定は擬似的なものになるか、あるいは反映されない可能性があります。
* **画像のパス**: `Image` コンポーネントを使う場合、絶対パスやBase64形式が確実です。
