package main

import (
	"net/http"
	"teachMe/db"
	"teachMe/handler"
	"teachMe/model"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	database := db.InitDB()

	// 1. モデルの反映
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

	// 2. ダミーデータの投入
	db.Seed(database)

	e := echo.New()
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{"http://localhost:3000"},
		AllowMethods: []string{http.MethodGet, http.MethodPut, http.MethodPost, http.MethodDelete},
	}))

	// 3. ルーティングの登録（各自のファイルをここで呼ぶ）
	e.GET("/", func(c echo.Context) error {
		return c.String(http.StatusOK, "Echoサーバーへようこそ！")
	})

	// あなたの担当分を登録
	handler.InitMailRoutes(e, database)

	// 他のメンバーも同様に InitXXXRoutes を作ってここに追加してもらう
	// handler.InitKKRoutes(e, database)

	e.Logger.Fatal(e.Start(":8080"))
}
