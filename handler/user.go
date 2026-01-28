package handler

import (
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
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	var user model.User
	err := h.DB.Where("email = ?", req.Email).First(&user).Error

	if err != nil || err == gorm.ErrRecordNotFound {
		// 初回ログイン
		user = model.User{
			Email:     req.Email,
			Name:      req.Name,
			AvatarURL: req.AvatarURL,
			RankID:    1,
		}
		h.DB.Create(&user)
	} else {
		// 既存ユーザーの更新
		user.Name = req.Name
		user.AvatarURL = req.AvatarURL
		h.DB.Save(&user)
	}

	return c.JSON(http.StatusOK, user)
}
