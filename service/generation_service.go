package service

import (
	"context"
	"fmt"

	"github.com/joho/godotenv"
	"google.golang.org/genai"

	"teachMe/model"
)

type GenerationHistorySaver interface {
	Create(ctx context.Context, gh *model.GenerationHistory) error
}

type GenerationService struct {
	Repo GenerationHistorySaver
}

func NewGenerationService(repo GenerationHistorySaver) *GenerationService {
	return &GenerationService{Repo: repo}
}

func (s *GenerationService) GenerateAndSave(
	ctx context.Context,
	prompt string,
	useGemini bool,
	userID uint64,
	emailListID uint64,
	myEmailListID uint64,
) (*model.GenerationHistory, error) {
	content, err := generateText(ctx, useGemini, prompt)
	if err != nil {
		return nil, err
	}

	gh := &model.GenerationHistory{
		UserID:        userID,
		EmailListID:   emailListID,
		MyEmailListID: myEmailListID,
		Content:       content,
	}

	if err := s.Repo.Create(ctx, gh); err != nil {
		return nil, fmt.Errorf("failed to save generated text: %w", err)
	}

	return gh, nil
}

func generateText(ctx context.Context, useGemini bool, prompt string) (string, error) {
	if useGemini {
		// .env is for local dev; ignore errors so containers/env-vars continue to work.
		_ = godotenv.Load()

		client, err := genai.NewClient(ctx, nil)
		if err != nil {
			return "", fmt.Errorf("error creating Gemini client: %w", err)
		}

		response, err := client.Models.GenerateContent(
			ctx,
			"gemini-3-flash-preview",
			genai.Text(prompt),
			nil,
		)
		if err != nil {
			return "", fmt.Errorf("error generating text: %w", err)
		}

		return string(response.Text()), nil
	}

	return "テスト（GeminiAPI 未使用）", nil
}
