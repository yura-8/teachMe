package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"teachMe/model"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type SentMailWithAddress struct {
	ID        uint64    `json:"id"`
	Content   string    `json:"content"`
	ToEmail   string    `json:"to_email"`
	FromEmail string    `json:"from_email"`
	CreatedAt time.Time `json:"created_at"`
}

func getUserID(c echo.Context, db *gorm.DB) uint64 {
	email := c.Request().Header.Get("X-User-Email")
	if email == "" {
		return 0
	}

	var user model.User
	if err := db.Where("email = ?", email).First(&user).Error; err == nil {
		return user.ID
	}

	name := strings.Split(email, "@")[0]
	newUser := model.User{
		Email:     email,
		Name:      name,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := db.Create(&newUser).Error; err != nil {
		fmt.Printf("CreateUser Error: %v\n", err)
		return 0
	}

	return newUser.ID
}

// InitMailRoutes ルーティング登録
func InitMailRoutes(e *echo.Echo, db *gorm.DB) {
	e.GET("/emails", GetEmailList(db))
	e.GET("/my-emails", GetMyEmails(db))
	e.GET("/signatures", GetSignatures(db))
	e.GET("/templates", GetTemplates(db))

	e.POST("/emails", CreateEmail(db))
	e.POST("/my-emails", CreateMyEmail(db))
	e.POST("/signatures", CreateSignature(db))
	e.POST("/templates", CreateTemplate(db))

	e.DELETE("/emails/:id", DeleteEmail(db))
	e.DELETE("/my-emails/:id", DeleteMyEmail(db))
	e.DELETE("/signatures/:id", DeleteSignature(db))
	e.DELETE("/templates/:id", DeleteTemplate(db))

	e.POST("/sent", CreateSentMail(db))
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

// ---------- GETs ----------

func GetEmailList(db *gorm.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := getUserID(c, db)
		if userID == 0 {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "ユーザーが見つかりません"})
		}
		var list []model.EmailList
		if err := db.Where("user_id = ?", userID).Find(&list).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "宛先一覧の取得に失敗しました"})
		}
		return c.JSON(http.StatusOK, list)
	}
}

func GetMyEmails(db *gorm.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := getUserID(c, db)
		if userID == 0 {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "ユーザーが見つかりません"})
		}
		var myEmails []model.MyEmailList
		if err := db.Where("user_id = ?", userID).Find(&myEmails).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "送信元アドレスの取得に失敗しました"})
		}
		return c.JSON(http.StatusOK, myEmails)
	}
}

func GetSignatures(db *gorm.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := getUserID(c, db)
		if userID == 0 {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "ユーザーが見つかりません"})
		}
		var signs []model.SignatureList
		if err := db.Where("user_id = ?", userID).Find(&signs).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "署名一覧の取得に失敗しました"})
		}
		return c.JSON(http.StatusOK, signs)
	}
}

func GetSentMails(db *gorm.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := getUserID(c, db)
		if userID == 0 {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "ユーザーが見つかりません"})
		}
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
			Where("sent_mails.user_id = ?", userID).
			Order("sent_mails.created_at " + sort)

		if emailListID != "" {
			q = q.Where("sent_mails.email_list_id = ?", emailListID)
		}

		if err := q.Limit(50).Scan(&result).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "送信履歴の取得に失敗しました"})
		}
		return c.JSON(http.StatusOK, result)
	}
}

// ---------- CREATEs (修正版: Soft Delete対応) ----------
type createEmailReq struct {
	Name      string `json:"name"`
	Email     string `json:"email"`
	AvatarURL string `json:"avatar_url"`
}

func CreateEmail(db *gorm.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := getUserID(c, db)
		if userID == 0 {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "ユーザーが見つかりません"})
		}
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

		// ★変更: Unscoped() で削除済みも含めて検索
		var existing model.EmailList
		if err := db.Unscoped().Where("user_id = ? AND lower(email) = lower(?)", userID, email).First(&existing).Error; err == nil {
			// レコードが存在する場合（削除済み含む）

			// もしIDはあるけどDeletedAtが入っていない（＝現在有効）なら重複エラー
			// ※GORMのモデル定義に依存するため、念のため普通の検索で「生きているか」確認
			var active model.EmailList
			if err := db.Where("id = ?", existing.ID).First(&active).Error; err == nil {
				return c.JSON(http.StatusConflict, map[string]string{"error": "既に登録されています"})
			}

			// ここに来る＝「削除済みデータがある」。なので復活させる（Update）
			if err := db.Model(&existing).Unscoped().Updates(map[string]interface{}{
				"deleted_at": nil, // 復活
				"name":       name,
				"avatar_url": avatar,
			}).Error; err != nil {
				return c.JSON(http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("復元失敗: %s", err.Error())})
			}
			return c.JSON(http.StatusCreated, existing)
		}

		// 全く新規の場合は作成
		record := model.EmailList{
			UserID:    userID,
			Name:      name,
			Email:     email,
			AvatarURL: avatar,
		}
		if err := db.Create(&record).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("保存失敗: %s", err.Error())})
		}
		return c.JSON(http.StatusCreated, record)
	}
}

type createMyEmailReq struct {
	Email string `json:"email"`
}

func CreateMyEmail(db *gorm.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := getUserID(c, db)
		if userID == 0 {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "ユーザーが見つかりません"})
		}
		req := new(createMyEmailReq)
		if err := c.Bind(req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "データの形式が正しくありません"})
		}

		email := strings.TrimSpace(req.Email)
		if email == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "email は必須です"})
		}

		var existing model.MyEmailList
		if err := db.Unscoped().Where("user_id = ? AND lower(email) = lower(?)", userID, email).First(&existing).Error; err == nil {
			var active model.MyEmailList
			if err := db.Where("id = ?", existing.ID).First(&active).Error; err == nil {
				return c.JSON(http.StatusConflict, map[string]string{"error": "既に登録されています"})
			}
			// 復元
			if err := db.Model(&existing).Unscoped().Updates(map[string]interface{}{
				"deleted_at": nil,
			}).Error; err != nil {
				return c.JSON(http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("復元失敗: %s", err.Error())})
			}
			return c.JSON(http.StatusCreated, existing)
		}

		record := model.MyEmailList{
			UserID: userID,
			Email:  email,
		}
		if err := db.Create(&record).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("保存失敗: %s", err.Error())})
		}
		return c.JSON(http.StatusCreated, record)
	}
}

type createSignatureReq struct {
	Content string `json:"content"`
}

func CreateSignature(db *gorm.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := getUserID(c, db)
		if userID == 0 {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "ユーザーが見つかりません"})
		}
		req := new(createSignatureReq)
		if err := c.Bind(req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "データの形式が正しくありません"})
		}

		content := strings.TrimSpace(req.Content)
		if content == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "content は必須です"})
		}

		var existing model.SignatureList
		if err := db.Unscoped().Where("user_id = ? AND content = ?", userID, content).First(&existing).Error; err == nil {
			var active model.SignatureList
			if err := db.Where("id = ?", existing.ID).First(&active).Error; err == nil {
				return c.JSON(http.StatusConflict, map[string]string{"error": "既に登録されています"})
			}
			// 復元
			if err := db.Model(&existing).Unscoped().Updates(map[string]interface{}{
				"deleted_at": nil,
			}).Error; err != nil {
				return c.JSON(http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("復元失敗: %s", err.Error())})
			}
			return c.JSON(http.StatusCreated, existing)
		}

		record := model.SignatureList{
			UserID:  userID,
			Content: content,
		}
		if err := db.Create(&record).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("保存失敗: %s", err.Error())})
		}
		return c.JSON(http.StatusCreated, record)
	}
}

// ---------- DELETEs ----------

func DeleteEmail(db *gorm.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := getUserID(c, db)
		if userID == 0 {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "ユーザーが見つかりません"})
		}

		id, err := parseIDParam(c)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "id が不正です"})
		}

		var target model.EmailList
		if err := db.Where("id = ? AND user_id = ?", id, userID).First(&target).Error; err != nil {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "宛先が見つかりません"})
		}

		var cnt int64
		if err := db.Model(&model.SentMail{}).Where("email_list_id = ? AND user_id = ?", id, userID).Count(&cnt).Error; err != nil {
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
		userID := getUserID(c, db)
		if userID == 0 {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "ユーザーが見つかりません"})
		}

		id, err := parseIDParam(c)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "id が不正です"})
		}

		var target model.MyEmailList
		if err := db.Where("id = ? AND user_id = ?", id, userID).First(&target).Error; err != nil {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "送信元が見つかりません"})
		}

		var cnt int64
		if err := db.Model(&model.SentMail{}).Where("my_email_list_id = ? AND user_id = ?", id, userID).Count(&cnt).Error; err != nil {
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
		userID := getUserID(c, db)
		if userID == 0 {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "ユーザーが見つかりません"})
		}

		id, err := parseIDParam(c)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "id が不正です"})
		}

		var target model.SignatureList
		if err := db.Where("id = ? AND user_id = ?", id, userID).First(&target).Error; err != nil {
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
		userID := getUserID(c, db)
		if userID == 0 {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "ユーザーが見つかりません"})
		}

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
		if err := db.Where("id = ? AND user_id = ?", req.EmailListID, userID).First(&to).Error; err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "宛先が存在しません"})
		}
		var from model.MyEmailList
		if err := db.Where("id = ? AND user_id = ?", req.MyEmailListID, userID).First(&from).Error; err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "送信元が存在しません"})
		}

		record := model.SentMail{
			Content:       content,
			EmailListID:   req.EmailListID,
			MyEmailListID: req.MyEmailListID,
			UserID:        userID,
		}
		if err := db.Create(&record).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("履歴保存失敗: %s", err.Error())})
		}

		return c.JSON(http.StatusCreated, record)
	}
}

// ---------- TEMPLATES ----------
func GetTemplates(db *gorm.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := getUserID(c, db)
		if userID == 0 {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "ユーザーが見つかりません"})
		}

		var list []model.Template
		q := db.Where("user_id = ?", userID)
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

func CreateTemplate(db *gorm.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := getUserID(c, db)
		if userID == 0 {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "ユーザーが見つかりません"})
		}

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

		var existing model.Template
		db.Where(
			"user_id = ? AND email_list_id = ? AND my_email_list_id = ? AND content = ?",
			userID, req.EmailListID, req.MyEmailListID, content,
		).Limit(1).Find(&existing)

		if existing.ID != 0 {
			return c.JSON(http.StatusConflict, map[string]string{"error": "既に同じテンプレが登録されています"})
		}

		record := model.Template{
			UserID:        userID,
			EmailListID:   req.EmailListID,
			MyEmailListID: req.MyEmailListID,
			Content:       content,
		}
		if err := db.Create(&record).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("テンプレ保存失敗: %s", err.Error())})
		}
		return c.JSON(http.StatusCreated, record)
	}
}

func DeleteTemplate(db *gorm.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := getUserID(c, db)
		if userID == 0 {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "ユーザーが見つかりません"})
		}

		id, err := parseIDParam(c)
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "id が不正です"})
		}

		var target model.Template
		if err := db.Where("id = ? AND user_id = ?", id, userID).First(&target).Error; err != nil {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "テンプレが見つかりません"})
		}
		if err := db.Delete(&target).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "削除に失敗しました"})
		}
		return c.NoContent(http.StatusNoContent)
	}
}
