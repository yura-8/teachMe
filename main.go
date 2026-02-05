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

	// マイグレーション（両方のモデルを含める）
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

	e := echo.New()

	// CORS設定（あなたの設定：X-User-Email等を許可したものを採用）
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{"http://localhost:3000"},
		AllowMethods: []string{http.MethodGet, http.MethodPut, http.MethodPost, http.MethodDelete},
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, "X-User-Email", "X-User-ID"},
	}))

	e.GET("/", func(c echo.Context) error {
		return c.String(http.StatusOK, "Echoサーバーへようこそ！")
	})

	// ★あなたのメール機能のルート設定
	handler.InitMailRoutes(e, database)

	// --- 以下、mainブランチからの機能追加 ---

	// ユーザー一覧（シンプル版）
	e.GET("/users", func(c echo.Context) error {
		var users []model.User
		database.Find(&users)
		return c.JSON(http.StatusOK, users)
	})

	// ユーザー一覧（API用・ソート付き）※mainブランチの実装
	e.GET("/api/users", func(c echo.Context) error {
		var users []model.User
		if err := database.Order("id asc").Find(&users).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusOK, users)
	})

	// ユーザーログイン・登録関連
	userHandler := handler.NewUserHandler(database)
	e.POST("/api/users/login", userHandler.LoginUser)

	// 文章生成機能
	generationHandler := handler.NewGenerationHandler(database)
	e.POST("/api/generate", generationHandler.TextGenerationHandler)

	// 他の人が実装したメールリスト取得機能（念のため残しておく）
	emailListHandler := handler.NewEmailListHandler(database)
	e.GET("/api/my_email_lists", emailListHandler.ListMyEmailLists)
	e.GET("/api/email_lists", emailListHandler.ListEmailLists)

	// サーバー起動
	e.Logger.Fatal(e.Start(":8080"))
}
