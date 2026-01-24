package db

import (
	"fmt"
	"os"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func InitDB() *gorm.DB {
	dsn := os.Getenv("DB_SOURCE")
	var db *gorm.DB
	var err error

	for i := 0; i < 10; i++ {
		// sql.Open ではなく gorm.Open を使う
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
		if err == nil {
			fmt.Println("✅ データベース接続成功！(GORM)")
			return db
		}
		fmt.Printf("DB接続待機中... (%d/10)\n", i+1)
		time.Sleep(2 * time.Second)
	}

	panic("データベースに接続できませんでした")
}