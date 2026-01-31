package main

import (
	"fmt"
	"log"
	"time"

	"teachMe/db"
	"teachMe/model"
)

/*
実行方法（Dockerで動かしている場合もOK）

おすすめ（Docker Compose の app コンテナ内で実行）:
  docker compose up -d db app
  docker compose exec app go run cmd/seed/main.go

ポイント:
  - app コンテナ内には docker-compose.yaml で DB_SOURCE が設定されている想定なので、
    追加の export なしで動きます（DB は service 名の "db" で到達可能）。

参考（ホスト(mac)から実行する場合）:
  docker compose up -d db
  export DB_SOURCE='postgresql://user:password@localhost:5432/teachme?sslmode=disable'
  go run cmd/seed/main.go

このプログラムは、POST /generate に渡すための ID（userId/emailListId/myEmailListId）を出力します。
  POST http://localhost:8080/generate
*/

// Seed for local/dev:
// - creates a minimal set of records to test text generation + DB persistence
// - prints IDs you can use when calling POST /generate
func main() {
	database := db.InitDB()

	// Ensure tables exist (same set as app, plus GenerationHistory).
	if err := database.AutoMigrate(
		&model.User{},
		&model.Rank{},
		&model.MyEmailList{},
		&model.EmailList{},
		&model.Vocabulary{},
		&model.SignatureList{},
		&model.SentMail{},
		&model.Template{},
		&model.GenerationHistory{},
	); err != nil {
		log.Fatalf("AutoMigrate failed: %v", err)
	}

	// 1) Rank: create only if empty (no uniqueness constraint on Rank)
	var rankCount int64
	if err := database.Model(&model.Rank{}).Count(&rankCount).Error; err != nil {
		log.Fatalf("count ranks failed: %v", err)
	}
	if rankCount == 0 {
		ranks := []model.Rank{
			{Grade: 1, ImageURL: "https://example.com/rank1.png", Content: "Starter", Point: 0},
			{Grade: 2, ImageURL: "https://example.com/rank2.png", Content: "Intermediate", Point: 100},
			{Grade: 3, ImageURL: "https://example.com/rank3.png", Content: "Advanced", Point: 300},
		}
		if err := database.Create(&ranks).Error; err != nil {
			log.Fatalf("create ranks failed: %v", err)
		}
	}

	var rank model.Rank
	if err := database.Order("id asc").First(&rank).Error; err != nil {
		log.Fatalf("load rank failed: %v", err)
	}

	// 2) User (unique by email)
	userEmail := "seed.user@example.com"
	var user model.User
	if err := database.Where("email = ?", userEmail).First(&user).Error; err != nil {
		user = model.User{
			Name:      "Seed User",
			Email:     userEmail,
			AvatarURL: "https://example.com/avatar.png",
			RankID:    rank.ID,
		}
		if err := database.Create(&user).Error; err != nil {
			log.Fatalf("create user failed: %v", err)
		}
	}

	// 3) MyEmailList (sender identity)
	myEmail := "me@example.com"
	var my model.MyEmailList
	if err := database.Where("user_id = ? AND email = ?", user.ID, myEmail).First(&my).Error; err != nil {
		my = model.MyEmailList{
			UserID: user.ID,
			Email:  myEmail,
		}
		if err := database.Create(&my).Error; err != nil {
			log.Fatalf("create my_email_list failed: %v", err)
		}
	}

	// 4) EmailList (recipient)
	recipientEmail := "recipient@example.com"
	var recipient model.EmailList
	if err := database.Where("user_id = ? AND email = ?", user.ID, recipientEmail).First(&recipient).Error; err != nil {
		recipient = model.EmailList{
			UserID:    user.ID,
			Name:      "Test Recipient",
			Email:     recipientEmail,
			AvatarURL: "https://example.com/recipient.png",
		}
		if err := database.Create(&recipient).Error; err != nil {
			log.Fatalf("create email_list failed: %v", err)
		}
	}

	// Optional data (not strictly required by /generate, but useful for future features)
	{
		var tplCount int64
		database.Model(&model.Template{}).
			Where("user_id = ? AND email_list_id = ? AND my_email_list_id = ?", user.ID, recipient.ID, my.ID).
			Count(&tplCount)
		if tplCount == 0 {
			tpl := model.Template{
				UserID:        user.ID,
				EmailListID:   recipient.ID,
				MyEmailListID: my.ID,
				Content:       "Hello {{name}},\n\nThanks for your email.\n\nBest regards,\n{{me}}",
				CreatedAt:     time.Now(),
				UpdatedAt:     time.Now(),
			}
			_ = database.Create(&tpl).Error
		}
	}

	fmt.Println("✅ Seed completed. Use these IDs for POST /generate:")
	fmt.Printf("userId=%d\n", user.ID)
	fmt.Printf("emailListId=%d\n", recipient.ID)
	fmt.Printf("myEmailListId=%d\n", my.ID)
	fmt.Println()
	fmt.Println("Example:")
	fmt.Println(`curl -X POST http://localhost:8080/generate \`)
	fmt.Println(`  -H 'Content-Type: application/json' \`)
	fmt.Printf("  -d '{\"prompt\":\"hi\",\"useGemini\":false,\"userId\":%d,\"emailListId\":%d,\"myEmailListId\":%d}'\n", user.ID, recipient.ID, my.ID)
}
