package db

import (
	"fmt"
	"teachMe/model"

	"gorm.io/gorm"
)

// Seed データベースに初期データを投入する
func Seed(db *gorm.DB) {
	testUser := model.User{ID: 1}
	db.FirstOrCreate(&testUser, model.User{
		ID:        1,
		Name:      "hoge太郎",
		AvatarURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
		RankID:    1,
	})

	db.FirstOrCreate(&model.EmailList{}, model.EmailList{
		ID:        1,
		UserID:    1,
		Name:      "huga教授",
		Email:     "rick@university.ac.jp",
		AvatarURL: "https://api.dicebear.com/7.x/pixel-art/svg?seed=Rick",
	})

	db.FirstOrCreate(&model.SignatureList{}, model.SignatureList{
		ID:      1,
		UserID:  1,
		Content: "東京電機大学 	理工学部\n情報システムデザイン学系 3年\nhoge 太郎",
	})

	fmt.Println("🌱 Seed data has been successfully injected.")
}
