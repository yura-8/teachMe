# Generation（フロントエンド）

## どこにアクセスする？

- 生成画面: `http://localhost:3000/generate`

## 起動方法（Docker Compose）

```sh
docker compose up --build
```

起動後のポート:

- Frontend（Next dev）: `http://localhost:3000`
- Backend（Echo）: `http://localhost:8080`

## 画面の実装

- Page: `frontend/app/generate/page.tsx`
- UI: `frontend/app/generate/GenerateClient.tsx`（client component）

レイアウト（画面内に収める前提）:

- 左: 設定パネル（User / MyEmailList / EmailList を選択）
- 右: 上から縦並び
  - 人のイラスト（大きめ丸アイコン）
  - 反省度スライダー（1〜5）
  - 本音（言い訳）入力 + 生成ボタン

### アバター表示ルール

- デフォルト画像: `frontend/public/business_man_angry.png`
  - 画面上のパスは `/business_man_angry.png`
- Userが選択され、`avatar_url` が空でない場合は `avatar_url` を優先して表示

## フロントから叩くAPI（Next Route Handlers）

ブラウザはバックエンドに直接アクセスせず、Next.js の `/api/*` を叩きます（CORS回避用のプロキシ）。

### 生成

- `POST http://localhost:3000/api/generate`
  - 実装: `frontend/app/api/generate/route.ts`
  - バックエンドの `POST /api/generate` にプロキシします

送信JSON（例）:

```json
{
  "prompt": "ゲームをしていたら、課題を出し忘れました。",
  "useGemini": false,
  "level": 3,
  "userId": 1,
  "emailListId": 1,
  "myEmailListId": 1
}
```

メモ:

- `userId/emailListId/myEmailListId` は `null` でもOK（未指定扱い）
- 画面上では送信JSON/レスポンスJSONを確認できます（デバッグ用）

### ユーザー一覧（ドロップダウン用）

- `GET http://localhost:3000/api/users`
  - 実装: `frontend/app/api/users/route.ts`
  - バックエンド `GET /api/users` にプロキシ

### MyEmailList（userに紐づく）

- `GET http://localhost:3000/api/my-email-lists?userId=<id>`
  - 実装: `frontend/app/api/my-email-lists/route.ts`
  - バックエンド `GET /api/my_email_lists?userId=...` にプロキシ

### EmailList（userに紐づく）

- `GET http://localhost:3000/api/email-lists?userId=<id>`
  - 実装: `frontend/app/api/email-lists/route.ts`
  - バックエンド `GET /api/email_lists?userId=...` にプロキシ

## UIコンポーネント（@/components/ui/*）

生成画面では `@/components/ui/*` のコンポーネントを利用しています。

- `frontend/components/ui/button.tsx`
- `frontend/components/ui/card.tsx`
- `frontend/components/ui/label.tsx`
- `frontend/components/ui/select.tsx`
- `frontend/components/ui/slider.tsx`
- `frontend/components/ui/textarea.tsx`

補足:

- これらはローカル実装のコンポーネントです（公式 `shadcn` CLI が生成したものではありません）。
- Button/Slider の色は `#FFF1C9` に寄せています。

## よくあるトラブル

### 「ユーザーなし / 選択肢なし」になる

- DBに `users` / `my_email_lists` / `email_lists` が入っていない状態です。
- seed を実行してデータを作成してください（バックエンド側のドキュメント参照）。

