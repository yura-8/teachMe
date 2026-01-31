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
  "text": "..."
}
```

注意:

- `text` は「生成結果そのもの」です。生成ロジック次第では、文字列として JSON っぽいテキストが返ることがあります（このAPIは中身をパース/検証しません）。

## DB保存（GenerationHistory）

モデル: `model/generation_history.go`

- `content` に生成後の文章を保存します
- `user_id/email_list_id/my_email_list_id` は NULL 可能です

保存フロー:

1. `handler/generation.go` がリクエストを `Bind`
2. `service/generation_service.go` が生成して `GenerationHistory{ Content: ... }` を作成
3. `repository/generation_history_repository.go` が `Create` で保存

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

