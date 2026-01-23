FROM golang:1.25-alpine

# ビルドに必要なツールをインストール
RUN apk add --no-cache git

# ホットリロード用のツール Air をインストール
RUN go install github.com/air-verse/air@latest

WORKDIR /app

# 先に依存関係をコピーしてキャッシュを効かせる
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Airを起動
CMD ["air", "-c", ".air.toml"]