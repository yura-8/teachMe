package handler

import (
	"net/http"
	"teachMe/model"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

func InitMailRoutes(e *echo.Echo, db *gorm.DB) {
	e.GET("/emails", GetEmailList(db))
	e.POST("/emails", CreateEmail(db))
	e.GET("/signatures", GetSignatures(db))
	e.POST("/signatures", CreateSignature(db))
}
func GetEmailList(db *gorm.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		var list []model.EmailList
		db.Where("user_id = ?", 1).Find(&list)
		return c.JSON(http.StatusOK, list)
	}
}

func GetSignatures(db *gorm.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		var signs []model.SignatureList
		db.Where("user_id = ?", 1).Find(&signs)
		return c.JSON(http.StatusOK, signs)
	}
}

// 宛先を新規登録する
func CreateEmail(db *gorm.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		//構造体を用意
		email := new(model.EmailList)

		//JSONを構造体にマッピング
		if err := c.Bind(email); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "データの形式が正しくありません"})
		}

		//必要な情報を補完
		email.UserID = 1

		//データベースに保存
		if err := db.Create(&email).Error; err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "データの保存に失敗しました"})
		}

		//成功したら作成されたデータを 201 Created で返す
		return c.JSON(http.StatusCreated, email)
	}
}

// 署名を新規登録する
func CreateSignature(db *gorm.DB) echo.HandlerFunc {
	return func(c echo.Context) error {
		sig := new(model.SignatureList)
		if err := c.Bind(sig); err != nil {
			return err
		}
		sig.UserID = 1
		db.Create(&sig)
		return c.JSON(http.StatusCreated, sig)
	}
}
