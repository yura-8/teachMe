package db

import (
    "database/sql"
    "fmt"
    "os"
    "time"

    _ "github.com/lib/pq"
)

// データベースを初期化し、接続オブジェクトを返す
func InitDB() *sql.DB {
    dsn := os.Getenv("DB_SOURCE")
    var db *sql.DB
    var err error

    for i := 0; i < 10; i++ {
        db, err = sql.Open("postgres", dsn)
        if err == nil && db.Ping() == nil {
            fmt.Println("✅ データベース接続成功！")
            return db
        }
        fmt.Printf("DB接続待機中... (%d/10)\n", i+1)
        time.Sleep(2 * time.Second)
    }

    panic("データベースに接続できませんでした")
}