# Tailwind CSS v4 Styling Guide

`apps/v2-modern` では、最新の **Tailwind CSS v4** (`@tailwindcss/vite`) を採用しています。
v3までとは設定方法やカスタマイズ方法が大きく異なるため注意が必要です。

## 1. 設定方法の変更 (`@theme inline`)

v4では `tailwind.config.js` が不要になり、CSSファイル内で `@theme` ブロックを使って変数を定義します。
また、色は広色域対応の `oklch` 関数を使用しています（モダンブラウザ向け）。

### 実装例: `src/index.css`

```css
@import "tailwindcss";
@import "tw-animate-css"; /* プラグインもCSSでImport */

/* カスタムバリアントの定義 */
@custom-variant dark (&:is(.dark *));

@theme inline {
  /* 角丸の定義 */
  --radius-sm: calc(var(--radius) - 4px);
  --radius: 0.625rem;
  
  /* カラーシステムの定義 (変数参照) */
  --color-primary: var(--primary);
  --color-background: var(--background);

  /* アニメーション定義 */
  --animate-slide-up: slide-up 1s ease-out forwards;

  @keyframes slide-up {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
}

/* Baseスタイルの定義 */
@layer base {
  body {
    @apply bg-background text-foreground;
  }
}
```

## 2. Dynamic Component Styling

コンポーネントのバリエーション管理には `class-variance-authority` (cva) と `tailwind-merge` を組み合わせるのが標準的です。

```tsx
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils' // clsx + tailwind-merge

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

// 使用例
<button className={cn(buttonVariants({ variant: "outline", size: "lg" }), className)}>
  Click me
</button>
```

## 3. なぜ `oklch` なのか？

v4ではデフォルトで P3 色域などをサポートするため、HSLではなく `oklch` が推奨されています。
知覚的な明るさが一定であるため、アクセシビリティの高い配色や、自動生成されるパレットのバランスが良くなります。

```css
:root {
  /* 明るさ(L), 彩度(C), 色相(H) */
  --primary: oklch(0.205 0 0); /* ほぼ黒 */
  --primary-foreground: oklch(0.985 0 0); /* ほぼ白 */
}
```

## 注意点

* **Editor Support**: VS CodeのTailwind CSS拡張機能を最新にする必要があります。
* **Class Detection**: 文字列結合などで動的にクラス名を生成すると検出されません。常に完全なクラス名を書くか、`cva` のようなライブラリ経由で静的に解析できるようにしてください。
