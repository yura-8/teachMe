package handler

import (
	"context"
	"fmt"
	"net/http"

	"github.com/joho/godotenv"
	"google.golang.org/genai"
)

func generateText(useGemini bool, prompt string, w http.ResponseWriter) string {
	if useGemini {
		fmt.Fprint(w, "Using Gemini API for text generation...\n")
		// Gemini APIを使った文章生成
		// .envファイルを読み込む
		err := godotenv.Load()
		if err != nil {
			return "Error loading .env file"
		}

		fmt.Fprint(w, "loaded .env file\n")

		ctx := context.Background()
		client, err := genai.NewClient(ctx, nil)
		if err != nil {
			return fmt.Sprintf("Error creating Gemini client: %v", err)
		}

		fmt.Fprint(w, "Gemini client created\n")

		response, err := client.Models.GenerateContent(
			ctx,
			"gemini-3-flash-preview",
			genai.Text(prompt),
			nil,
		)
		if err != nil {
			return "Error generating text: " + err.Error()
		}
		output := "Prompt: " + prompt + "\n\n"
		output += string(response.Text())
		return output
	} else {
		// テスト用のダミー文章生成
		result := "テスト（GeminiAPI 未使用）"
		result += "\nプロンプト: " + prompt
		return result
	}
}

func TextGenerationHandler(w http.ResponseWriter, r *http.Request) {
	prompt := "Explain how AI works in a few words"
	useGemini := false

	result := generateText(useGemini, prompt, w)
	fmt.Fprint(w, result)
}