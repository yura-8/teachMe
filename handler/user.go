package handler

import (
	"errors"
	"net/http"
	"teachMe/model"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type UserHandler struct {
	DB *gorm.DB
}

func NewUserHandler(db *gorm.DB) *UserHandler {
	return &UserHandler{DB: db}
}

// POST /api/users/login
func (h *UserHandler) LoginUser(c echo.Context) error {
	// 受け取るJSON
	var req struct {
		Email     string `json:"email"`
		Name      string `json:"name"`
		AvatarURL string `json:"avatar_url"`
	}

	if err := c.Bind(&req); err != nil {
		c.Logger().Error("❌ Failed to bind request:", err)
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	c.Logger().Info("📥 Received login request:", req.Email, req.Name)

	var user model.User
	err := h.DB.Where("email = ?", req.Email).First(&user).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		// 初回ログイン
		c.Logger().Info("🆕 Creating new user:", req.Email)
		user = model.User{
			Email:     req.Email,
			Name:      req.Name,
			AvatarURL: req.AvatarURL,
			RankID:    1,
		}
		if err := h.DB.Create(&user).Error; err != nil {
			c.Logger().Error("❌ Failed to create user:", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
	} else if err == nil {
		// 既存ユーザーの更新
		c.Logger().Info("🔄 Updating existing user:", req.Email)
		user.Name = req.Name
		user.AvatarURL = req.AvatarURL
		if err := h.DB.Save(&user).Error; err != nil {
			c.Logger().Error("❌ Failed to update user:", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
	} else {
		c.Logger().Error("❌ Failed to look up user:", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// ログインしたユーザー自身のメールは、文章生成画面の「MyEmailList（自分のEmail）」で選べるようにする。
	// 既に存在する場合は重複作成しない。
	if user.ID != 0 && user.Email != "" {
		var existing model.MyEmailList
		err := h.DB.Where("user_id = ? AND email = ?", user.ID, user.Email).First(&existing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			_ = h.DB.Create(&model.MyEmailList{UserID: user.ID, Email: user.Email}).Error
		}
	}

	c.Logger().Info("✅ Login successful for:", req.Email)
	return c.JSON(http.StatusOK, user)
}
