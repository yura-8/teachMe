package handler

import (
    "teachMe/model"
    "gorm.io/gorm"
)

type VocabularyService struct {
    DB *gorm.DB // 大文字にして外部から入れられるように
}

func (s *VocabularyService) RegisterVocabulary(userID uint64, word string, profID uint64) error {
    // 重複チェック：同じユーザー、同じ教授、同じ言葉があるか確認
    var existing model.Vocabulary
    err := s.DB.Where("user_id = ? AND email_list_id = ? AND word = ?", userID, profID, word).First(&existing).Error
    
    if err == nil {
        // 既にある場合は、保存せずに終了
        return nil 
    }

    // 語彙の保存
    vocab := model.Vocabulary{
        UserID:      userID,
        Word:        word,
        EmailListID: profID,
    }
    if err := s.DB.Create(&vocab).Error; err != nil {
        return err
    }

    // ランク更新ロジック
    var count int64
    s.DB.Model(&model.Vocabulary{}).Where("user_id = ?", userID).Count(&count)
    currentPoints := uint(count * 10)

    var nextRank model.Rank
    // Pointが現在の合計値以下で、最大のPointを持つランクを取得
    s.DB.Where("point <= ?", currentPoints).Order("point DESC").First(&nextRank)

    return s.DB.Model(&model.User{}).Where("id = ?", userID).Update("rank_id", nextRank.ID).Error
}

func (s *VocabularyService) CopyToProfessor(userID uint64, vocabIDs []uint64, targetProfID uint64) error {
    var sourceVocabs []model.Vocabulary
    s.DB.Where("id IN ? AND user_id = ?", vocabIDs, userID).Find(&sourceVocabs)

    for _, v := range sourceVocabs {
        // 重複チェック
        var count int64
        s.DB.Model(&model.Vocabulary{}).Where("user_id = ? AND email_list_id = ? AND word = ?", userID, targetProfID, v.Word).Count(&count)
        
        if count == 0 {
            newVocab := model.Vocabulary{
                Word:        v.Word,
                EmailListID: targetProfID,
                UserID:      userID,
            }
            s.DB.Create(&newVocab)
        }
    }
    return nil
}

// 特定の教授(profID)に登録されている語彙一覧を取得
func (s *VocabularyService) GetVocabulariesByProfessor(userID uint64, profID uint64) ([]model.Vocabulary, error) {
    var vocabs []model.Vocabulary
    err := s.DB.Where("user_id = ? AND email_list_id = ?", userID, profID).Find(&vocabs).Error
    return vocabs, err
}