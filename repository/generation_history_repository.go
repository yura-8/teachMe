package repository

import (
	"context"

	"teachMe/model"

	"gorm.io/gorm"
)

type GenerationHistoryRepository struct {
	DB *gorm.DB
}

func NewGenerationHistoryRepository(db *gorm.DB) *GenerationHistoryRepository {
	return &GenerationHistoryRepository{DB: db}
}

func (r *GenerationHistoryRepository) Create(ctx context.Context, gh *model.GenerationHistory) error {
	return r.DB.WithContext(ctx).Create(gh).Error
}
