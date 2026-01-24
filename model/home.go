package model

import (
	"time"
)

type User struct {
	ID        uint64      `gorm:"primaryKey;autoIncrement" json:"id"`
	Name      string    `gorm:"size:255;not null" json:"name"`
	AvatarURL string    `gorm:"size:255" json:"avatar_url"`
	RankID    uint64      `gorm:"not null" json:"rank_id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type MyEmailList struct {
	ID        uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    uint64    `json:"user_id"`
	Email     string    `gorm:"size:255;not null" json:"email"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type EmailList struct {
	ID        uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    uint64    `json:"user_id"`
	Name      string    `gorm:"size:255" json:"name"`
	Email     string    `gorm:"size:255;not null" json:"email"`
	AvatarURL string    `gorm:"size:255" json:"avatar_url"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Vocabulary struct {
	ID            uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	Word          string    `gorm:"size:255;not null" json:"word"`
	EmailListID   uint64    `json:"email_list_id"`
	MyEmailListID uint64    `json:"my_email_list_id"`
	UserID        uint64    `json:"user_id"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type SignatureList struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Content   string    `gorm:"type:text;not null" json:"content"`
	UserID    uint      `gorm:"not null" json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type SentMail struct {
	ID            uint64      `gorm:"primaryKey;autoIncrement" json:"id"`
	Content       string    `gorm:"type:text;not null" json:"content"`
	EmailListID   uint64      `gorm:"not null" json:"email_list_id"`
	MyEmailListID uint64      `gorm:"not null" json:"my_email_list_id"`
	UserID        uint64      `gorm:"not null" json:"user_id"`
	CreatedAt     time.Time `json:"created_at"`
}

type Template struct {
	ID            uint64      `gorm:"primaryKey;autoIncrement" json:"id"`
	Content       string    `gorm:"type:text;not null" json:"content"`
	EmailListID   uint64      `gorm:"not null" json:"email_list_id"`
	MyEmailListID uint64      `gorm:"not null" json:"my_email_list_id"`
	UserID        uint64      `gorm:"not null" json:"user_id"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type Rank struct {
	ID        uint64      `gorm:"primaryKey;autoIncrement" json:"id"`
	Grade     uint      `gorm:"not null" json:"grade"`
	ImageURL  string    `gorm:"size:255;not null" json:"image_url"`
	Content   string    `gorm:"type:text;not null" json:"content"`
	Point     uint      `gorm:"not null" json:"point"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
