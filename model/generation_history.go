package model

import "time"

// GenerationHistory represents a generated text saved to the database.
// Content stores the generated output.
type GenerationHistory struct {
	ID uint64 `gorm:"primaryKey" json:"id"`

	// These may be NULL to allow generation without selecting a user/list.
	UserID        *uint64 `json:"userId"`
	EmailListID   *uint64 `json:"emailListId"`
	MyEmailListID *uint64 `json:"myEmailListId"`

	Content string `gorm:"type:text;not null" json:"content"` // 生成された文章を保存

	CreatedAt time.Time `json:"createdAt"`
}
