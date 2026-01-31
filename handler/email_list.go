package handler

import (
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
