"use client";

import { useState } from "react";
import styles from "./vocabulary.module.css";

export default function VocabularyPage() {
  const [word, setWord] = useState("");
  const lineCount = word.split("\n").length;
  const displayRows = lineCount > 3 ? 3 : lineCount;
  
  // 教授ごとのデータ（本来はAPIから取得する想定）
  const [profVocabMap, setProfVocabMap] = useState([
    {
      profId: 101,
      profName: "神部 教授",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=prof1",
      vocabs: [
        { id: 1, word: "睡眠障害に起因する概日リズムの乱れにより", checked: false },
        { id: 2, word: "自己管理の不足を痛感しており", checked: false },
      ]
    },
    {
      profId: 202,
      profName: "佐藤 教授",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=prof2",
      vocabs: [
        { id: 3, word: "不慮の事態が重なり、学問を志す身として", checked: false },
      ]
    }
  ]);

  // 現在選択中の教授（一番上の表示用）
  const currentProf = profVocabMap[0];

  return (
    <div className={styles.container}>
      {/* 1. 最上部：選択中の教授アイコンと名前 */}
      <div className={styles.currentProfSelector}>
        <div className={styles.profBadge}>
          <img src={currentProf.avatar} alt="icon" className={styles.avatarMini} />
          <span className={styles.profNameLabel}>{currentProf.profName}</span>
        </div>
      </div>

      {/* 2. 中央：貯金箱エリア */}
      <section className={styles.heroSection}>
        <div className={styles.piggyBankWrapper}>
          <div className={styles.speechBubble}>
            <textarea 
              placeholder="登録したい言葉" 
              className={styles.wordInput}
              value={word}
              onChange={(e) => setWord(e.target.value)}
              rows={displayRows}
            />
          </div>
          {/* 画像がない場合は public/piggy_bank.png を配置してください */}
          <img src="/piggy_bank.png" alt="貯金箱" className={styles.piggyImg} />
        </div>

        <button className={styles.registerButton}>登録する</button>
      </section>

      {/* 3. 下部：教授ごとのリスト表示 */}
      <section className={styles.listSection}>
        {profVocabMap.map((profData) => (
          <div key={profData.profId} className={styles.profListGroup}>
            <div className={styles.listHeader}>
              <img src={profData.avatar} alt="icon" className={styles.avatarMicro} />
              <p className={styles.listLabel}>{profData.profName}</p>
            </div>
            
            <div className={styles.tableContainer}>
              <table className={styles.vocabTable}>
                <tbody>
                  {profData.vocabs.map((item) => (
                    <tr key={item.id}>
                      <td className={styles.checkCol}>
                        <input type="checkbox" /> 
                      </td>
                      <td className={styles.wordCol}>{item.word}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        <div className={styles.actionButtons}>
          <button className={styles.subButton}>登録する</button>
          <button className={styles.subButton}>削除する</button>
        </div>
      </section>
    </div>
  );
}