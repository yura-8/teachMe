package main

import (
	"net/http"
	"teachMe/db"
	"teachMe/handler"
	"teachMe/model"

	"github.com/labstack/echo/v4"
)

func main() {
	database := db.InitDB()

	// モデルをデータベースに反映させる
	database.AutoMigrate(
		&model.User{},
		&model.Rank{},
		&model.MyEmailList{},
		&model.EmailList{},
		&model.Vocabulary{},
		&model.SignatureList{},
		&model.SentMail{},
		&model.Template{},
	)

	// Echoのインスタンスを作成
	e := echo.New()

	// ルーティング
	// http://localhost:8080/
	e.GET("/", func(c echo.Context) error {
		return c.String(http.StatusOK, "Echoサーバーへようこそ！")
	})

	// ユーザー一覧を取得するエンドポイント
	e.GET("/users", func(c echo.Context) error {
		var users []model.User
		database.Find(&users) // DBから全ユーザー取得
		return c.JSON(http.StatusOK, users)
	})
	userHandler := handler.NewUserHandler(database)
	e.POST("/api/users/login", userHandler.LoginUser)
	// サーバー起動
	e.Logger.Fatal(e.Start(":8080"))
}
