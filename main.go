package main

import (
	"net/http"
	"teachMe/db"
	"teachMe/handler"
	"teachMe/model"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

func SeedRanks(db *gorm.DB) {
    ranks := []model.Rank{
        {ID: 1, Grade: 1, Point: 0, Content: "アメーバ級", ImageURL: "url1"},
        {ID: 2, Grade: 2, Point: 50, Content: "一般学生級", ImageURL: "url2"},
        {ID: 3, Grade: 3, Point: 150, Content: "准教授級", ImageURL: "url3"},
        {ID: 4, Grade: 4, Point: 300, Content: "文豪級", ImageURL: "url4"},
    }

    for _, r := range ranks {
        // IDがなければ作成、あれば更新（FirstOrCreateでも可）
        db.FirstOrCreate(&r, model.Rank{ID: r.ID})
    }
}

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

	SeedRanks(database)

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

	vocabService := &handler.VocabularyService{DB: database}

  // 語彙登録API
  e.POST("/vocabularies", func(c echo.Context) error {
    // フロントから受け取る構造体
    type Request struct {
      UserID uint64 `json:"user_id"`
      Word   string `json:"word"`
      ProfID uint64 `json:"prof_id"`
    }
    req := new(Request)
    if err := c.Bind(req); err != nil {
    	return err
    }

    if err := vocabService.RegisterVocabulary(req.UserID, req.Word, req.ProfID); err != nil {
      return c.JSON(http.StatusInternalServerError, err)
    }
    return c.JSON(http.StatusOK, "語彙力貯金完了！")
  })

	// 既存の語彙を別の教授にコピー登録するAPI
  e.POST("/vocabularies/copy", func(c echo.Context) error {
  	type Request struct {
      UserID       uint64   `json:"user_id"`
      VocabIDs     []uint64 `json:"vocab_ids"` // チェックしたIDのリスト
      TargetProfID uint64   `json:"target_prof_id"` // 登録先の教授ID
	  }
    req := new(Request)
    if err := c.Bind(req); err != nil {
      return err
    }

    if err := vocabService.CopyToProfessor(req.UserID, req.VocabIDs, req.TargetProfID); err != nil {
      return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
    }
    return c.JSON(http.StatusOK, map[string]string{"message": "教授への語彙コピーが完了しました！"})
  })

	// 特定の教授の語彙一覧を取得するAPI
  e.GET("/vocabularies", func(c echo.Context) error {
    userID := c.QueryParam("user_id")
    profID := c.QueryParam("prof_id")

    var vocabs []model.Vocabulary
      if profID != "" {
        // 教授ID指定がある場合
        database.Where("user_id = ? AND email_list_id = ?", userID, profID).Find(&vocabs)
      } else {
        // 指定がない場合は全件
        database.Where("user_id = ?", userID).Find(&vocabs)
      }
        
      return c.JSON(http.StatusOK, vocabs)
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
