package handler

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"

	"teachMe/repository"
	"teachMe/service"
)

// API Usage Example:
// POST: http://localhost:8080/generate
// Body: {"prompt":"Hello, world!","useGemini":true}
// Output: {"prompt":"Hello, world!","useGemini":true,"text":"Generated text...","id":1}

type GenerationHandler struct {
	Service *service.GenerationService
}

func NewGenerationHandler(db *gorm.DB) *GenerationHandler {
	repo := repository.NewGenerationHistoryRepository(db)
	svc := service.NewGenerationService(repo)
	return &GenerationHandler{Service: svc}
}

func (h *GenerationHandler) TextGenerationHandler(c echo.Context) error {
	var req struct {
		Prompt        string  `json:"prompt"`
		UseGemini     bool    `json:"useGemini"`
		Level         int     `json:"level"` // 1-5: 反省度
		UserID        uint64  `json:"userId"`
		EmailListID   uint64  `json:"emailListId"`
		MyEmailListID uint64  `json:"myEmailListId"`
	}

	if err := c.Bind(&req); err != nil {
		c.Logger().Error("❌ Failed to bind request:", err)
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	prompt := req.Prompt
	if prompt == "" {
		prompt = "Explain how AI works in a few words"
	}

	res, err := h.Service.GenerateAndSave(
		c.Request().Context(),
		prompt,
		req.UseGemini,
		req.Level,
		req.UserID,
		req.EmailListID,
		req.MyEmailListID,
	)
	if err != nil {
		c.Logger().Error("❌ Text generation failed:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]any{
		"id":            res.History.ID,
		"userId":        res.History.UserID,
		"emailListId":   res.History.EmailListID,
		"myEmailListId": res.History.MyEmailListID,
		"prompt":        prompt,
		"useGemini":     req.UseGemini,
		"subject":       res.Draft.Subject,
		"body":          res.Draft.Body,
		"text":          res.Draft.Body,
	})
}
