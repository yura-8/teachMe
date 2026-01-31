package handler

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"teachMe/model"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

const devUserID uint64 = 1

type SentMailWithAddress struct {
	ID        uint64    `json:"id"`
	Content   string    `json:"content"`
	ToEmail   string    `json:"to_email"`
	FromEmail string    `json:"from_email"`
	CreatedAt time.Time `json:"created_at"`
}

func InitMailRoutes(e *echo.Echo, db *gorm.DB) {
	// master fetch
	e.GET("/emails", GetEmailList(db))
	e.GET("/my-emails", GetMyEmails(db))
	e.GET("/signatures", GetSignatures(db))
	e.GET("/templates", GetTemplates(db))

	// master create
	e.POST("/emails", CreateEmail(db))
	e.POST("/my-emails", CreateMyEmail(db))
	e.POST("/signatures", CreateSignature(db))
	e.POST("/templates", CreateTemplate(db))

	// master delete
	e.DELETE("/emails/:id", DeleteEmail(db))
	e.DELETE("/my-emails/:id", DeleteMyEmail(db))
	e.DELETE("/signatures/:id", DeleteSignature(db))
	e.DELETE("/templates/:id", DeleteTemplate(db))

	// sent
	e.POST("/sent", CreateSentMail(db))

	// ★送信履歴（絞り込み・ソート対応）
	e.GET("/sent", GetSentMails(db))
}

// ---------- helpers ----------
func parseIDParam(c echo.Context) (uint64, error) {
	idStr := c.Param("id")
	id64, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil || id64 == 0 {
		return 0, err
	}
	return id64, nil
}

func parseUintQuery(c echo.Context, key string) (uint64, bool) {
	v := strings.TrimSpace(c.QueryParam(key))
	if v == "" {
		return 0, false
	}
	u, err := strconv.ParseUint(v, 10, 64)
	if err != nil || u == 0 {
		return 0, false
	}
	return u, true
}

func parseLimit(c echo.Context, def int) int {
	v := strings.TrimSpace(c.QueryParam("limit"))
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	if n < 1 {
		return 1
	}
	if n > 200 {
		return 200
	}
	return n
}

// ---------- GETs ----------
func GetEmailList(db *gorm.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		var list []model.EmailList
		if err := db.Where("user_id = ?", devUserID).Find(&list).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "宛先一覧の取得に失敗しました"})
		}
		return c.JSON(http.StatusOK, list)
	}
}

func GetMyEmails(db *gorm.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		var myEmails []model.MyEmailList
		if err := db.Where("user_id = ?", devUserID).Find(&myEmails).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "送信元アドレスの取得に失敗しました"})
		}
		return c.JSON(http.StatusOK, myEmails)
	}
}

func GetSignatures(db *gorm.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		var signs []model.SignatureList
		if err := db.Where("user_id = ?", devUserID).Find(&signs).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "署名一覧の取得に失敗しました"})
		}
		return c.JSON(http.StatusOK, signs)
	}
}

// ★送信履歴取得（絞り込み・ソート・limit・検索）
func GetSentMails(db *gorm.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		var result []SentMailWithAddress

		sort := c.QueryParam("sort")
		if sort != "asc" {
			sort = "desc"
		}

		emailListID := c.QueryParam("email_list_id")

		q := db.Table("sent_mails").
			Select(`
				sent_mails.id,
				sent_mails.content,
				sent_mails.created_at,
				el.email  as to_email,
				me.email  as from_email
			`).
			Joins("JOIN email_lists el ON el.id = sent_mails.email_list_id").
			Joins("JOIN my_email_lists me ON me.id = sent_mails.my_email_list_id").
			Where("sent_mails.user_id = ?", 1).
			Order("sent_mails.created_at " + sort)

		if emailListID != "" {
			q = q.Where("sent_mails.email_list_id = ?", emailListID)
		}

		if err := q.Limit(50).Scan(&result).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "送信履歴の取得に失敗しました",
			})
		}

		return c.JSON(http.StatusOK, result)
	}
}

// ---------- CREATEs ----------
type createEmailReq struct {
	Name      string `json:"name"`
	Email     string `json:"email"`
	AvatarURL string `json:"avatar_url"`
}

func CreateEmail(db *gorm.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		req := new(createEmailReq)
		if err := c.Bind(req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "データの形式が正しくありません"})
		}

		email := strings.TrimSpace(req.Email)
		name := strings.TrimSpace(req.Name)
		avatar := strings.TrimSpace(req.AvatarURL)

		if email == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "email は必須です"})
		}

		var existing model.EmailList
		if err := db.Where("user_id = ? AND lower(email) = lower(?)", devUserID, email).First(&existing).Error; err == nil {
			return c.JSON(http.StatusConflict, map[string]string{"error": "既に登録されています"})
		} else if err != gorm.ErrRecordNotFound {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "宛先の重複チェックに失敗しました"})
		}

		record := model.EmailList{
			UserID:    devUserID,
			Name:      name,
			Email:     email,
			AvatarURL: avatar,
		}
		if err := db.Create(&record).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "データの保存に失敗しました"})
		}
		return c.JSON(http.StatusCreated, record)
	}
}

type createMyEmailReq struct {
	Email string `json:"email"`
}

func CreateMyEmail(db *gorm.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		req := new(createMyEmailReq)
		if err := c.Bind(req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "データの形式が正しくありません"})
		}

		email := strings.TrimSpace(req.Email)
		if email == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "email は必須です"})
		}

		var existing model.MyEmailList
		if err := db.Where("user_id = ? AND lower(email) = lower(?)", devUserID, email).First(&existing).Error; err == nil {
			return c.JSON(http.StatusConflict, map[string]string{"error": "既に登録されています"})
		} else if err != gorm.ErrRecordNotFound {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "送信元の重複チェックに失敗しました"})
		}

		record := model.MyEmailList{
			UserID: devUserID,
			Email:  email,
		}
		if err := db.Create(&record).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "データの保存に失敗しました"})
		}
		return c.JSON(http.StatusCreated, record)
	}
}

type createSignatureReq struct {
	Content string `json:"content"`
}

func CreateSignature(db *gorm.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		req := new(createSignatureReq)
		if err := c.Bind(req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "データの形式が正しくありません"})
		}

		content := strings.TrimSpace(req.Content)
		if content == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "content は必須です"})
		}

		var existing model.SignatureList
		if err := db.Where("user_id = ? AND content = ?", devUserID, content).First(&existing).Error; err == nil {
			return c.JSON(http.StatusConflict, map[string]string{"error": "既に登録されています"})
		} else if err != gorm.ErrRecordNotFound {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "署名の重複チェックに失敗しました"})
		}

		record := model.SignatureList{
			UserID:  devUserID,
			Content: content,
		}
		if err := db.Create(&record).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "データの保存に失敗しました"})
		}
		return c.JSON(http.StatusCreated, record)
	}
}

// ---------- DELETEs ----------
func DeleteEmail(db *gorm.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		id, err := parseIDParam(c)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "id が不正です"})
		}

		var target model.EmailList
		if err := db.Where("id = ? AND user_id = ?", id, devUserID).First(&target).Error; err != nil {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "宛先が見つかりません"})
		}

		var cnt int64
		if err := db.Model(&model.SentMail{}).Where("email_list_id = ? AND user_id = ?", id, devUserID).Count(&cnt).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "参照チェックに失敗しました"})
		}
		if cnt > 0 {
			return c.JSON(http.StatusConflict, map[string]string{"error": "送信履歴で使用中のため削除できません"})
		}

		if err := db.Delete(&target).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "削除に失敗しました"})
		}
		return c.NoContent(http.StatusNoContent)
	}
}

func DeleteMyEmail(db *gorm.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		id, err := parseIDParam(c)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "id が不正です"})
		}

		var target model.MyEmailList
		if err := db.Where("id = ? AND user_id = ?", id, devUserID).First(&target).Error; err != nil {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "送信元が見つかりません"})
		}

		var cnt int64
		if err := db.Model(&model.SentMail{}).Where("my_email_list_id = ? AND user_id = ?", id, devUserID).Count(&cnt).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "参照チェックに失敗しました"})
		}
		if cnt > 0 {
			return c.JSON(http.StatusConflict, map[string]string{"error": "送信履歴で使用中のため削除できません"})
		}

		if err := db.Delete(&target).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "削除に失敗しました"})
		}
		return c.NoContent(http.StatusNoContent)
	}
}

func DeleteSignature(db *gorm.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		id, err := parseIDParam(c)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "id が不正です"})
		}

		var target model.SignatureList
		if err := db.Where("id = ? AND user_id = ?", id, devUserID).First(&target).Error; err != nil {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "署名が見つかりません"})
		}

		if err := db.Delete(&target).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "削除に失敗しました"})
		}
		return c.NoContent(http.StatusNoContent)
	}
}

// ---------- SENT ----------
type createSentReq struct {
	Content       string `json:"content"`
	EmailListID   uint64 `json:"email_list_id"`
	MyEmailListID uint64 `json:"my_email_list_id"`
}

func CreateSentMail(db *gorm.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		req := new(createSentReq)
		if err := c.Bind(req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "データの形式が正しくありません"})
		}

		content := strings.TrimSpace(req.Content)
		if content == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "content は必須です"})
		}
		if req.EmailListID == 0 || req.MyEmailListID == 0 {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "宛先/送信元が未指定です"})
		}

		var to model.EmailList
		if err := db.Where("id = ? AND user_id = ?", req.EmailListID, devUserID).First(&to).Error; err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "宛先が存在しません"})
		}
		var from model.MyEmailList
		if err := db.Where("id = ? AND user_id = ?", req.MyEmailListID, devUserID).First(&from).Error; err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "送信元が存在しません"})
		}

		record := model.SentMail{
			Content:       content,
			EmailListID:   req.EmailListID,
			MyEmailListID: req.MyEmailListID,
			UserID:        devUserID,
		}
		if err := db.Create(&record).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "履歴の保存に失敗しました"})
		}

		return c.JSON(http.StatusCreated, record)
	}

}

// GetTemplates テンプレ一覧（宛先/送信元で絞り込み）
func GetTemplates(db *gorm.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		var list []model.Template

		q := db.Where("user_id = ?", devUserID)

		if v := c.QueryParam("email_list_id"); v != "" {
			q = q.Where("email_list_id = ?", v)
		}
		if v := c.QueryParam("my_email_list_id"); v != "" {
			q = q.Where("my_email_list_id = ?", v)
		}

		if err := q.Order("updated_at desc").Find(&list).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "テンプレの取得に失敗しました"})
		}
		return c.JSON(http.StatusOK, list)
	}
}

type createTemplateReq struct {
	Content       string `json:"content"`
	EmailListID   uint64 `json:"email_list_id"`
	MyEmailListID uint64 `json:"my_email_list_id"`
}

// CreateTemplate テンプレを保存（宛先/送信元必須）
func CreateTemplate(db *gorm.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		req := new(createTemplateReq)
		if err := c.Bind(req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "データの形式が正しくありません"})
		}

		content := strings.TrimSpace(req.Content)
		if content == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "content は必須です"})
		}
		if req.EmailListID == 0 || req.MyEmailListID == 0 {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "宛先/送信元が未指定です"})
		}

		// 重複チェック（同じ宛先・送信元・本文は弾く）
		var existing model.Template
		err := db.Where(
			"user_id = ? AND email_list_id = ? AND my_email_list_id = ? AND content = ?",
			devUserID, req.EmailListID, req.MyEmailListID, content,
		).First(&existing).Error

		if err == nil {
			return c.JSON(http.StatusConflict, map[string]string{"error": "既に同じテンプレが登録されています"})
		}
		if err != gorm.ErrRecordNotFound {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "重複チェックに失敗しました"})
		}

		record := model.Template{
			UserID:        devUserID,
			EmailListID:   req.EmailListID,
			MyEmailListID: req.MyEmailListID,
			Content:       content,
		}

		if err := db.Create(&record).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "テンプレの保存に失敗しました"})
		}

		return c.JSON(http.StatusCreated, record)
	}
}

// DeleteTemplate テンプレ削除
func DeleteTemplate(db *gorm.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		id, err := parseIDParam(c)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "id が不正です"})
		}

		var target model.Template
		if err := db.Where("id = ? AND user_id = ?", id, devUserID).First(&target).Error; err != nil {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "テンプレが見つかりません"})
		}

		if err := db.Delete(&target).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "削除に失敗しました"})
		}
		return c.NoContent(http.StatusNoContent)
	}
}
