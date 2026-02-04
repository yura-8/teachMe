package handler

import (
	"errors"
	"net/http"
	"strconv"

	"teachMe/model"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type EmailListHandler struct {
	DB *gorm.DB
}

func NewEmailListHandler(db *gorm.DB) *EmailListHandler {
	return &EmailListHandler{DB: db}
}

// GET /api/my_email_lists?userId=1
func (h *EmailListHandler) ListMyEmailLists(c echo.Context) error {
	userIDStr := c.QueryParam("userId")
	var userID uint64
	if userIDStr != "" {
		n, err := strconv.ParseUint(userIDStr, 10, 64)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid userId"})
		}
		userID = n
	}

	// Googleログイン等で作成されたユーザーは MyEmailList が空のままになることがあるため、
	// userId が指定されている場合は「ユーザー自身のメール」を MyEmailList に自動で用意する。
	if userID != 0 {
		var user model.User
		if err := h.DB.First(&user, userID).Error; err == nil && user.Email != "" {
			var existing model.MyEmailList
			err := h.DB.Where("user_id = ? AND email = ?", user.ID, user.Email).First(&existing).Error
			if errors.Is(err, gorm.ErrRecordNotFound) {
				_ = h.DB.Create(&model.MyEmailList{UserID: user.ID, Email: user.Email}).Error
			}
		}
	}

	var rows []model.MyEmailList
	q := h.DB
	if userID != 0 {
		q = q.Where("user_id = ?", userID)
	}
	if err := q.Order("id asc").Find(&rows).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, rows)
}

// GET /api/email_lists?userId=1
func (h *EmailListHandler) ListEmailLists(c echo.Context) error {
	userIDStr := c.QueryParam("userId")
	var userID uint64
	if userIDStr != "" {
		n, err := strconv.ParseUint(userIDStr, 10, 64)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid userId"})
		}
		userID = n
	}

	// 宛先は「自分以外のユーザー」から選べるようにするため、
	// userId が指定されている場合は、全ユーザー（自分以外）を EmailList として自動で用意する。
	if userID != 0 {
		var others []model.User
		if err := h.DB.Where("id <> ?", userID).Order("id asc").Find(&others).Error; err == nil {
			for _, u := range others {
				if u.Email == "" {
					continue
				}
				var existing model.EmailList
				err := h.DB.Where("user_id = ? AND email = ?", userID, u.Email).First(&existing).Error
				if errors.Is(err, gorm.ErrRecordNotFound) {
					_ = h.DB.Create(&model.EmailList{
						UserID:    userID,
						Name:      u.Name,
						Email:     u.Email,
						AvatarURL: u.AvatarURL,
					}).Error
				}
			}
		}
	}

	var rows []model.EmailList
	q := h.DB
	if userID != 0 {
		q = q.Where("user_id = ?", userID)
	}
	if err := q.Order("id asc").Find(&rows).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, rows)
}
