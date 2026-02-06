package main

import (
	"errors"
	"fmt"
	"log"
	"math/rand"
	"os"
	"path/filepath"
	"time"

	"teachMe/db"
	"teachMe/model"

	"gorm.io/gorm"
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

このプログラムは、POST /api/generate に渡すための ID（userId/emailListId/myEmailListId）を出力します。
  POST http://localhost:8080/api/generate
*/

// Seed for local/dev:
// - creates a minimal set of records to test text generation + DB persistence
// - prints IDs you can use when calling POST /api/generate
func main() {
	database := db.InitDB()

	iconURLs := loadIconURLs()
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	pickIcon := func() string {
		if len(iconURLs) == 0 {
			return "/default.png"
		}
		return iconURLs[rng.Intn(len(iconURLs))]
	}

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
	// if rankCount == 0 {
	// 	ranks := []model.Rank{
	// 		{Grade: 1, ImageURL: "https://example.com/rank1.png", Content: "Starter", Point: 0},
	// 		{Grade: 2, ImageURL: "https://example.com/rank2.png", Content: "Intermediate", Point: 100},
	// 		{Grade: 3, ImageURL: "https://example.com/rank3.png", Content: "Advanced", Point: 300},
	// 	}
	// 	if err := database.Create(&ranks).Error; err != nil {
	// 		log.Fatalf("create ranks failed: %v", err)
	// 	}
	// }

	var rank model.Rank
	if err := database.Order("id asc").First(&rank).Error; err != nil {
		log.Fatalf("load rank failed: %v", err)
	}

	type seedRecipient struct {
		Name      string
		Email     string
		AvatarURL string
	}
	type seedUser struct {
		Name       string
		Email      string
		AvatarURL  string
		MyEmails   []string
		Recipients []seedRecipient
	}

	seedUsers := []seedUser{
		{
			Name:      "Alice Seed",
			Email:     "alice.seed@example.com",
			AvatarURL: pickIcon(),
			MyEmails: []string{
				"alice.seed@example.com",
				"alice.seed+univ@example.com",
			},
			Recipients: []seedRecipient{
				{Name: "田中教授", Email: "tanaka.prof@example.com", AvatarURL: pickIcon()},
				{Name: "鈴木TA", Email: "suzuki.ta@example.com", AvatarURL: pickIcon()},
				{Name: "事務局", Email: "office@example.com", AvatarURL: pickIcon()},
			},
		},
		{
			Name:      "Bob Seed",
			Email:     "bob.seed@example.com",
			AvatarURL: pickIcon(),
			MyEmails: []string{
				"bob.seed@example.com",
			},
			Recipients: []seedRecipient{
				{Name: "山田教授", Email: "yamada.prof@example.com", AvatarURL: pickIcon()},
				{Name: "佐藤TA", Email: "sato.ta@example.com", AvatarURL: pickIcon()},
			},
		},
		{
			Name:      "Carol Seed",
			Email:     "carol.seed@example.com",
			AvatarURL: pickIcon(),
			MyEmails: []string{
				"carol.seed@example.com",
			},
			Recipients: []seedRecipient{
				{Name: "中村教授", Email: "nakamura.prof@example.com", AvatarURL: pickIcon()},
				{Name: "学務係", Email: "student-affairs@example.com", AvatarURL: pickIcon()},
			},
		},
	}

	ensureUser := func(u seedUser) model.User {
		var user model.User
		err := database.Where("email = ?", u.Email).First(&user).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			user = model.User{
				Name:      u.Name,
				Email:     u.Email,
				AvatarURL: u.AvatarURL,
				RankID:    rank.ID,
			}
			if err := database.Create(&user).Error; err != nil {
				log.Fatalf("create user (%s) failed: %v", u.Email, err)
			}
			return user
		}
		if err != nil {
			log.Fatalf("load user (%s) failed: %v", u.Email, err)
		}

		user.Name = u.Name
		user.AvatarURL = u.AvatarURL
		user.RankID = rank.ID
		if err := database.Save(&user).Error; err != nil {
			log.Fatalf("update user (%s) failed: %v", u.Email, err)
		}
		return user
	}

	ensureMyEmail := func(userID uint64, email string) model.MyEmailList {
		var row model.MyEmailList
		err := database.Where("user_id = ? AND email = ?", userID, email).First(&row).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			row = model.MyEmailList{UserID: userID, Email: email}
			if err := database.Create(&row).Error; err != nil {
				log.Fatalf("create my_email_list (%d,%s) failed: %v", userID, email, err)
			}
			return row
		}
		if err != nil {
			log.Fatalf("load my_email_list (%d,%s) failed: %v", userID, email, err)
		}
		return row
	}

	ensureRecipient := func(userID uint64, r seedRecipient) model.EmailList {
		var row model.EmailList
		err := database.Where("user_id = ? AND email = ?", userID, r.Email).First(&row).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			row = model.EmailList{
				UserID:    userID,
				Name:      r.Name,
				Email:     r.Email,
				AvatarURL: r.AvatarURL,
			}
			if err := database.Create(&row).Error; err != nil {
				log.Fatalf("create email_list (%d,%s) failed: %v", userID, r.Email, err)
			}
			return row
		}
		if err != nil {
			log.Fatalf("load email_list (%d,%s) failed: %v", userID, r.Email, err)
		}

		row.Name = r.Name
		row.AvatarURL = r.AvatarURL
		if err := database.Save(&row).Error; err != nil {
			log.Fatalf("update email_list (%d,%s) failed: %v", userID, r.Email, err)
		}
		return row
	}

	// Optional data (not strictly required by /generate, but useful for future features)
	type idsForGenerate struct {
		UserID        uint64
		MyEmailListID uint64
		EmailListID   uint64
	}
	var examples []idsForGenerate

	for _, su := range seedUsers {
		u := ensureUser(su)

		var myFirst model.MyEmailList
		for i, me := range su.MyEmails {
			row := ensureMyEmail(u.ID, me)
			if i == 0 {
				myFirst = row
			}
		}

		var recipientFirst model.EmailList
		for i, r := range su.Recipients {
			row := ensureRecipient(u.ID, r)
			if i == 0 {
				recipientFirst = row
			}
		}

		// Template: create only if missing for (user, first recipient, first myEmail)
		if u.ID != 0 && myFirst.ID != 0 && recipientFirst.ID != 0 {
			var tplCount int64
			database.Model(&model.Template{}).
				Where("user_id = ? AND email_list_id = ? AND my_email_list_id = ?", u.ID, recipientFirst.ID, myFirst.ID).
				Count(&tplCount)
			if tplCount == 0 {
				tpl := model.Template{
					UserID:        u.ID,
					EmailListID:   recipientFirst.ID,
					MyEmailListID: myFirst.ID,
					Content:       "Hello {{name}},\n\nThanks for your email.\n\nBest regards,\n{{me}}",
					CreatedAt:     time.Now(),
					UpdatedAt:     time.Now(),
				}
				_ = database.Create(&tpl).Error
			}
		}

		examples = append(examples, idsForGenerate{
			UserID:        u.ID,
			MyEmailListID: myFirst.ID,
			EmailListID:   recipientFirst.ID,
		})
	}

	fmt.Println("✅ Seed completed. Example IDs for POST /api/generate:")
	for _, ex := range examples {
		fmt.Printf("userId=%d emailListId=%d myEmailListId=%d\n", ex.UserID, ex.EmailListID, ex.MyEmailListID)
	}
	fmt.Println()
	fmt.Println("Example:")
	fmt.Println(`curl -X POST http://localhost:8080/api/generate \`)
	fmt.Println(`  -H 'Content-Type: application/json' \`)
	if len(examples) > 0 {
		ex := examples[0]
		fmt.Printf("  -d '{\"prompt\":\"hi\",\"useGemini\":false,\"userId\":%d,\"emailListId\":%d,\"myEmailListId\":%d}'\n", ex.UserID, ex.EmailListID, ex.MyEmailListID)
	}
}

func loadIconURLs() []string {
	extOK := func(ext string) bool {
		switch ext {
		case ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg":
			return true
		default:
			return false
		}
	}

	wd, err := os.Getwd()
	if err != nil {
		return nil
	}

	// When running `go run cmd/seed/main.go` from repo root, this is `frontend/public/icons`.
	// When running from `cmd/seed`, it becomes `../frontend/public/icons`.
	candidates := []string{
		filepath.Join(wd, "frontend", "public", "icons"),
		filepath.Join(wd, "..", "frontend", "public", "icons"),
		filepath.Join(wd, "..", "..", "frontend", "public", "icons"),
	}

	var iconsDir string
	for _, c := range candidates {
		if st, err := os.Stat(c); err == nil && st.IsDir() {
			iconsDir = c
			break
		}
	}
	if iconsDir == "" {
		return nil
	}

	var urls []string
	_ = filepath.WalkDir(iconsDir, func(path string, d os.DirEntry, err error) error {
		if err != nil || d == nil {
			return nil
		}
		name := d.Name()
		if len(name) > 0 && name[0] == '.' {
			if d.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		if d.IsDir() {
			return nil
		}
		ext := filepath.Ext(name)
		if !extOK(ext) {
			return nil
		}
		rel, err := filepath.Rel(iconsDir, path)
		if err != nil {
			return nil
		}
		rel = filepath.ToSlash(rel)
		urls = append(urls, "/icons/"+rel)
		return nil
	})

	return urls
}
