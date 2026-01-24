package main

import (
	"net/http"
	"teachMe/db"
	"teachMe/model"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	// DB接続
	database := db.InitDB()
	defer database.Close()

	// Echoのインスタンスを作成
	e := echo.New()

	// CORSの設定
e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
    AllowOrigins: []string{"http://localhost:3000"},
    AllowMethods: []string{http.MethodGet, http.MethodPut, http.MethodPost, http.MethodDelete},
}))

	// ルーティング
	// http://localhost:8080/
	e.GET("/", func(c echo.Context) error {
		return c.String(http.StatusOK, "Echoサーバーへようこそ！")
	})

	// サーバー起動
	e.Logger.Fatal(e.Start(":8080"))
}