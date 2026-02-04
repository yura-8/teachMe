# Generation（バックエンド）

## どこにアクセスする？

- Backend（Echo API）: `http://localhost:8080/`
- Postgres（Docker公開）: `localhost:5432`

## 起動方法（Docker Compose）

```sh
docker compose up --build
```

## ルーティング一覧

実装: `main.go`

- `GET /` : ヘルスチェック（文字列）
- `GET /users` : User一覧（旧/学習用）
- `GET /api/users` : User一覧（フロントが利用）
- `POST /api/users/login` : ログイン/ユーザー作成（NextAuth callback から利用）
- `POST /api/generate` : 文章生成 + DB保存
- `GET /api/my_email_lists?userId=<id>` : MyEmailList一覧（userIdで絞り込み可）
- `GET /api/email_lists?userId=<id>` : EmailList一覧（userIdで絞り込み可）

## 文章生成API

実装:

- Handler: `handler/generation.go`
- Service: `service/generation_service.go`
- Repository: `repository/generation_history_repository.go`
- Model: `model/generation_history.go`

### Endpoint

- `POST http://localhost:8080/api/generate`

### Request（JSON）

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

- `level`: 反省度（1〜5）
- `userId/emailListId/myEmailListId`: `null` または未指定でもOK（DBもNULL保存可能）

### Response（JSON）

```json
{
  "id": 123,
  "userId": 1,
  "emailListId": 1,
  "myEmailListId": 1,
  "prompt": "ゲームをしていたら、課題を出し忘れました。",
  "useGemini": false,
  "subject": "課題提出に関するお詫び",
  "body": "..."
}
```

注意:

- 生成結果は内部的に「JSONっぽいテキスト」になることがあります（特に Gemini 生成時）。
- 現在は `service/generation_service.go` で **生成結果をパース/検証** し、`subject` と `body` を必ず取り出します（取り出せない場合はフォールバックで補完します）。
- DBには `body` のみ保存します（スキーマが `content` だけのため）。

## DB保存（GenerationHistory）

モデル: `model/generation_history.go`

- `content` に生成後の文章を保存します
- `user_id/email_list_id/my_email_list_id` は NULL 可能です
  - `prompt/useGemini/subject` はDBに保存しません（レスポンスとして返すのみ）。

保存フロー:

1. `handler/generation.go` がリクエストを `Bind`
2. `service/generation_service.go` が生成結果から `subject/body` を抽出（パース/検証 + フォールバック）
3. `GenerationHistory{ Content: body }` を作成して保存
4. `repository/generation_history_repository.go` が `Create` で保存

## Gemini を使う場合（API Key）

`useGemini=true` の場合、API key が必要です。

- `.env`（リポジトリルート）に以下のどちらかを設定します:
  - `GEMINI_API_KEY=...`
  - `GOOGLE_API_KEY=...`（フォールバック）

または Docker の `services.app.environment` に設定してください（本番運用想定ならこちら推奨）。

## DB接続

実装: `db/db.go`

- 環境変数 `DB_SOURCE` をDSNとして利用
- 最大10回リトライ（2秒間隔）

Docker Compose では `docker-compose.yaml` の `services.app.environment.DB_SOURCE` で設定します。

## データ投入（seed）

実装: `cmd/seed/main.go`

### 実行（ホストから）

```sh
export DB_SOURCE='postgresql://user:password@localhost:5432/teachme?sslmode=disable'
go run cmd/seed/main.go
```

seed が作るもの（最低限）:

- `Rank`（空なら作成）
- `User`（email固定）
- `MyEmailList`
- `EmailList`

## よくあるトラブル

### 生成はできるが保存で 500 になる

- モデル変更後にDBスキーマが古いままのことがあります（開発中は特に）
- 開発環境なら DB を作り直すのが早いです（全データ消えます）

```sh
docker compose down -v
rm -rf postgres_data
docker compose up --build -d
```
