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
		&model.GenerationHistory{},
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
	// フロント向け（CORS回避のためにNext側でプロキシする想定）
	e.GET("/api/users", func(c echo.Context) error {
		var users []model.User
		if err := database.Order("id asc").Find(&users).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusOK, users)
	})

	userHandler := handler.NewUserHandler(database)
	e.POST("/api/users/login", userHandler.LoginUser)
	// 文章生成をするエンドポイント
	generationHandler := handler.NewGenerationHandler(database)
	e.POST("/api/generate", generationHandler.TextGenerationHandler)

	emailListHandler := handler.NewEmailListHandler(database)
	e.GET("/api/my_email_lists", emailListHandler.ListMyEmailLists)
	e.GET("/api/email_lists", emailListHandler.ListEmailLists)

	// サーバー起動
	e.Logger.Fatal(e.Start(":8080"))
}
