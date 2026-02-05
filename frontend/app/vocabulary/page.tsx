"use client";

import { useState, useEffect } from "react";
import styles from "./vocabulary.module.css";

interface Vocabulary {
  id: number;
  word: string;
  email_list_id: number;
}

interface Professor {
  id: number;
  name: string;
  avatar_url: string;
}

export default function VocabularyPage() {
  const [word, setWord] = useState("");
  const [professors, setProfessors] = useState<Professor[]>([
    { id: 101, name: "神部 教授", avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=prof1" },
    { id: 202, name: "佐藤 教授", avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=prof2" },
  ]);
  const [vocabList, setVocabList] = useState<Vocabulary[]>([]);
  const [selectedIDs, setSelectedIDs] = useState<number[]>([]);

  const currentUserID = 1; 
  const [selectedProfID, setSelectedProfID] = useState(101);

  const [isProfMenuOpen, setIsProfMenuOpen] = useState(false);

  const lineCount = word.split("\n").length;
  const displayRows = lineCount > 3 ? 3 : lineCount;

  const [showRankModal, setShowRankModal] = useState(false);
  const [currentRank, setCurrentRank] = useState<{content: string, image_url: string} | null>(null);
  const [lastRankID, setLastRankID] = useState<number | null>(null);

  // 語彙一覧を取得
  const fetchVocabularies = async () => {
    try {
      const res = await fetch(`http://localhost:8080/vocabularies?user_id=${currentUserID}`);
      const data = await res.json();
      setVocabList(data || []);
    } catch (err) {
      console.error("Failed to fetch:", err);
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const res = await fetch(`http://localhost:8080/users`); // ユーザー一覧から自分のランクを取得
        const users = await res.json();
        const me = users.find((u: any) => u.id === currentUserID);
        if (me) {
          setLastRankID(me.rank_id); // 初期ランクを保存
        }
      } catch (err) { console.error(err); }
    };
    fetchUserData();
    fetchVocabularies();
  }, []);

  // 新規登録
  const handleRegister = async () => {
  if (!word.trim()) return;
  try {
    const res = await fetch("http://localhost:8080/vocabularies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: currentUserID,
        word: word,
        prof_id: selectedProfID,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setWord("");
      fetchVocabularies();

      // ランクアップ判定：返ってきたIDが保持しているIDより大きい場合のみ
      if (data.rank && lastRankID !== null && data.rank.id > lastRankID) {
        setCurrentRank(data.rank);
        setLastRankID(data.rank.id); // 次回の判定のために更新
        setShowRankModal(true);      // モーダルを表示
      } else if (data.rank && lastRankID === null) {
        // 初めての登録などでIDが取れた場合は保存だけしておく
        setLastRankID(data.rank.id);
      }
    }
  } catch (err) { console.error(err); }
};

  // 削除機能
  const handleCheck = (id: number) => {
    setSelectedIDs(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleDelete = async () => {
    if (selectedIDs.length === 0) return;
    try {
      const res = await fetch("http://localhost:8080/vocabularies", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: currentUserID,
          vocab_ids: selectedIDs,
        }),
      });
      if (res.ok) {
        setSelectedIDs([]);
        fetchVocabularies();
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  // コピー機能
  const handleCopy = async () => {
    if (selectedIDs.length === 0) return;
    try {
      const res = await fetch("http://localhost:8080/vocabularies/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: currentUserID,
          vocab_ids: selectedIDs,
          target_prof_id: selectedProfID, 
        }),
      });
      if (res.ok) {
        setSelectedIDs([]); 
        fetchVocabularies(); // 最新の全データを再取得
      }
    } catch (err) {
      console.error("Copy error:", err);
    }
  };

  const currentProf = professors.find(p => p.id === selectedProfID) || professors[0];

  const hasAnyVocab = vocabList.length > 0;

  return (
    <div className={styles.container}>
      {/* 選択中の教授バッジ & セレクトメニュー */}
      <div className={styles.currentProfSelector}>
        <div 
          className={styles.profBadge} 
          onClick={() => setIsProfMenuOpen(!isProfMenuOpen)}
          style={{ cursor: "pointer" }}
        >
          <img src={currentProf.avatar_url} alt="icon" className={styles.avatarMini} />
          <span className={styles.profNameLabel}>{currentProf.name} ▼</span>
        </div>

        {/* 教授一覧メニュー：開いているときだけ表示 */}
        {isProfMenuOpen && (
          <div className={styles.profDropdown}>
            {professors.map((p) => (
              <div 
                key={p.id} 
                className={styles.profOption}
                onClick={() => {
                  setSelectedProfID(p.id);
                  setIsProfMenuOpen(false); // 選択したら閉じる
                }}
              >
                <img src={p.avatar_url} alt="" className={styles.avatarMicro} />
                <span>{p.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 貯金箱エリア */}
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
          <img src="/piggy_bank.png" alt="貯金箱" className={styles.piggyImg} />
        </div>
        <button className={styles.registerButton} onClick={handleRegister}>
          登録する
        </button>
      </section>

      {/* リスト表示） */}
      <section className={styles.listSection}>
        {professors.map((prof) => {
          const filteredVocabs = vocabList.filter(v => v.email_list_id === prof.id);
          
          // 語彙がない教授のセクションはスキップ
          if (filteredVocabs.length === 0) return null;

          return (
            <div key={prof.id} className={styles.profListGroup}>
              <div className={styles.listHeader}>
                <img src={prof.avatar_url} alt="icon" className={styles.avatarMicro} />
                <p className={styles.listLabel}>{prof.name}</p>
              </div>
              <div className={styles.tableContainer}>
                <table className={styles.vocabTable}>
                  <tbody>
                    {filteredVocabs.map((item) => (
                      <tr key={item.id}>
                        <td className={styles.checkCol}>
                          <input 
                            type="checkbox" 
                            checked={selectedIDs.includes(item.id)} 
                            onChange={() => handleCheck(item.id)} 
                          />
                        </td>
                        <td className={styles.wordCol}>{item.word}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {/* 語彙が1つでもある場合のみ、アクションボタンを表示 */}
        {hasAnyVocab && (
          <div className={styles.actionButtons}>
            <button className={styles.subButton} onClick={handleCopy}>登録する</button>
            <button className={styles.subButton} onClick={handleDelete}>削除する</button>
          </div>
        )}
      </section>
      {/* ランクアップ */}
      {showRankModal && currentRank && (
        <div className={styles.modalOverlay} onClick={() => setShowRankModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>ランクアップ！</h2>
            <img src={currentRank.image_url} alt={currentRank.content} className={styles.rankImg} />
            <p className={styles.modalText}>
              あなたの知性は <strong>{currentRank.content}</strong> になりました！
            </p>
            <button className={styles.modalCloseButton} onClick={() => setShowRankModal(false)}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}