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

	e := echo.New()
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{"http://localhost:3000"},
		AllowMethods: []string{http.MethodGet, http.MethodPut, http.MethodPost, http.MethodDelete},
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, "X-User-ID"},
	}))

	e.GET("/", func(c echo.Context) error {
		return c.String(http.StatusOK, "Echoサーバーへようこそ！")
	})

	handler.InitMailRoutes(e, database)

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
