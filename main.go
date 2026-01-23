package main

import (
    "teachMe/db"
    "net/http"
    "github.com/labstack/echo/v4"
		_ "github.com/lib/pq"
)

func main() {
	// DB接続
	database := db.InitDB()
	defer database.Close()

	// Echoのインスタンスを作成
	e := echo.New()

	// ルーティング
	// http://localhost:8080/
	e.GET("/", func(c echo.Context) error {
		return c.String(http.StatusOK, "Echoサーバーへようこそ！")
	})

	// サーバー起動
	e.Logger.Fatal(e.Start(":8080"))
}