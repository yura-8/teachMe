package handler

import (
	"context"
	"fmt"
	"net/http"

	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	"google.golang.org/genai"
)

// API Usage Example:
// POST: http://localhost:8080/generate
// Body: {"prompt":"Hello, world!","useGemini":true}
// Output: {"prompt":"Hello, world!","useGemini":true,"text":"Generated text..."}

func generateText(useGemini bool, prompt string) (string, error) {
	if useGemini {
		// Gemini APIを使った文章生成
		// .env はローカル開発用。環境変数が既にセットされているケースもあるので失敗しても続行する。
		_ = godotenv.Load()

		ctx := context.Background()
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
		output := string(response.Text())
		return output, nil
	} else {
		// テスト用のダミー文章生成
		result := "テスト（GeminiAPI 未使用）"
		return result, nil
	}
}

func TextGenerationHandler(c echo.Context) error {
	var req struct {
		Prompt    string `json:"prompt"`
		UseGemini bool   `json:"useGemini"`
	}

	if err := c.Bind(&req); err != nil {
		c.Logger().Error("❌ Failed to bind request:", err)
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	prompt := req.Prompt
	if prompt == "" {
		prompt = "Explain how AI works in a few words"
	}

	result, err := generateText(req.UseGemini, prompt)
	if err != nil {
		c.Logger().Error("❌ Text generation failed:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]any{
		"prompt":    prompt,
		"useGemini": req.UseGemini,
		"text":      result,
	})
}
