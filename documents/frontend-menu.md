# フロントエンド: 画面左上メニュー（PageMenu）の使い方

## 目的
`frontend/components/PageMenu.tsx` は、左上の `menu.svg` ボタンを押すとドロップダウンを表示し、クリックした項目の `href` にページ遷移するコンポーネントです。

遷移先は **配列で定義**するため、Bページ/Cページなどへの項目追加が簡単です。

## 使い方（例: 文章生成ページ）
`frontend/app/generate/page.tsx` のように、`items` を配列で渡します。

```ts
import PageMenu, { type PageMenuItem } from "@/components/PageMenu";

const menuItems: PageMenuItem[] = [
  { label: "ログインへ", href: "/login" },
];

<PageMenu items={menuItems} className="fixed left-4 top-4 z-50" />
```

## 項目の追加方法（B/Cページを増やす）
`menuItems` に要素を足すだけでOKです。

```ts
const menuItems: PageMenuItem[] = [
  { label: "ログインへ", href: "/login" },
  { label: "Bページへ", href: "/b" },
  { label: "Cページへ", href: "/c" },
];
```

## 他のページで使う
他のページでも同様に `PageMenu` を import して `items` を渡してください。
ページごとにメニュー内容を変えたい場合は、そのページ内で `menuItems` を定義します。

共通化したい場合は、例えば `frontend/lib/menuItems.ts` のようなファイルを作って配列を export し、各ページから import する形にすると管理しやすくなります。

メニューアイコンのURL
https://icooon-mono.com/12590-%e3%83%a1%e3%83%8b%e3%83%a5%e3%83%bc%e3%81%ae%e7%84%a1%e6%96%99%e3%82%a2%e3%82%a4%e3%82%b3%e3%83%b310/
