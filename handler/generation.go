package handler

import (
	"errors"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"

	"teachMe/model"
	"teachMe/repository"
	"teachMe/service"
)

// API Usage Example:
// POST: http://localhost:8080/generate
// Body: {"prompt":"Hello, world!","useGemini":true}
// Output: {"prompt":"Hello, world!","useGemini":true,"text":"Generated text...","id":1}

type GenerationHandler struct {
	Service *service.GenerationService
	DB      *gorm.DB
}

func NewGenerationHandler(db *gorm.DB) *GenerationHandler {
	repo := repository.NewGenerationHistoryRepository(db)
	svc := service.NewGenerationService(repo)
	return &GenerationHandler{Service: svc, DB: db}
}

func buildVocabularyHint(db *gorm.DB, userID uint64, emailListID uint64) (hint string, count int, toEmail string, err error) {
	if db == nil || userID == 0 || emailListID == 0 {
		return "", 0, "", nil
	}

	var to model.EmailList
	if err := db.Where("id = ? AND user_id = ?", emailListID, userID).First(&to).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", 0, "", nil
		}
		return "", 0, "", err
	}

	toEmail = strings.TrimSpace(to.Email)
	if toEmail == "" {
		return "", 0, "", nil
	}

	var professor model.User
	if err := db.Where("lower(email) = lower(?)", toEmail).First(&professor).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", 0, toEmail, nil
		}
		return "", 0, toEmail, err
	}

	var rows []model.Vocabulary
	if err := db.
		Where("user_id = ? AND email_list_id = ?", userID, professor.ID).
		Order("updated_at desc").
		Limit(200).
		Find(&rows).Error; err != nil {
		return "", 0, toEmail, err
	}

	seen := make(map[string]struct{}, len(rows))
	words := make([]string, 0, 30)
	for _, r := range rows {
		w := strings.TrimSpace(r.Word)
		if w == "" {
			continue
		}
		if _, ok := seen[w]; ok {
			continue
		}
		seen[w] = struct{}{}
		words = append(words, w)
		if len(words) >= 30 {
			break
		}
	}

	if len(words) == 0 {
		return "", 0, toEmail, nil
	}
	return "ユーザーはこのような語彙を使います: " + strings.Join(words, "、"), len(words), toEmail, nil
}

func (h *GenerationHandler) TextGenerationHandler(c echo.Context) error {
	var req struct {
		Prompt        string `json:"prompt"`
		UseGemini     bool   `json:"useGemini"`
		Level         int    `json:"level"` // 1-5: 反省度
		UserID        uint64 `json:"userId"`
		EmailListID   uint64 `json:"emailListId"`
		MyEmailListID uint64 `json:"myEmailListId"`
	}

	if err := c.Bind(&req); err != nil {
		c.Logger().Error("❌ Failed to bind request:", err)
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	prompt := req.Prompt
	if prompt == "" {
		prompt = "Explain how AI works in a few words"
	}

	vocabHint, vocabCount, toEmail, err := buildVocabularyHint(h.DB, req.UserID, req.EmailListID)
	if err != nil {
		c.Logger().Error("❌ Failed to build vocabulary hint:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	if vocabHint != "" {
		c.Logger().Infof("📚 Vocabulary hint applied: count=%d to=%s", vocabCount, toEmail)
	}

	res, err := h.Service.GenerateAndSave(
		c.Request().Context(),
		prompt,
		req.UseGemini,
		req.Level,
		req.UserID,
		req.EmailListID,
		req.MyEmailListID,
		vocabHint,
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
		"prompt":        res.Prompt,
		"useGemini":     req.UseGemini,
		"subject":       res.Draft.Subject,
		"body":          res.Draft.Body,
		"text":          res.Draft.Body,
	})
}
