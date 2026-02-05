"use client";

import { useState, useEffect } from "react";
import styles from "./vocabulary.module.css";
import PageMenu, { type PageMenuItem } from "@/components/PageMenu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

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
  const menuItems: PageMenuItem[] = [
    { label: "文章生成へ", href: "/generate" },
    { label: "語彙へ", href: "/vocabulary" },
    { label: "ログアウト", href: "/logout" },
  ];

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
        const res = await fetch(`http://localhost:8080/users`); 
        const users = await res.json();
        const me = users.find((u: any) => u.id === currentUserID);
        if (me) {
          setLastRankID(me.rank_id);
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

        // ランクアップ判定
        if (data.rank && lastRankID !== null && data.rank.id > lastRankID) {
          setCurrentRank(data.rank);
          setLastRankID(data.rank.id);
          setShowRankModal(true);
        } else if (data.rank && lastRankID === null) {
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
        fetchVocabularies();
      }
    } catch (err) {
      console.error("Copy error:", err);
    }
  };

  const currentProf = professors.find(p => p.id === selectedProfID) || professors[0];
  const hasAnyVocab = vocabList.length > 0;

  return (
    <div className={styles.container}>
      <PageMenu items={menuItems} className="fixed left-4 top-4 z-50" />
      <main className={styles.mainWrapper}>
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

        {isProfMenuOpen && (
          <Card className={styles.profDropdown}>
            {professors.map((p) => (
              <div 
                key={p.id} 
                className={styles.profOption}
                onClick={() => {
                  setSelectedProfID(p.id);
                  setIsProfMenuOpen(false);
                }}
              >
                <img src={p.avatar_url} alt="" className={styles.avatarMicro} />
                <span>{p.name}</span>
              </div>
            ))}
          </Card>
        )}
      </div>

      {/* 貯金箱エリア */}
      <section className={styles.heroSection}>
        <div className={styles.piggyBankWrapper}>
          <div className={styles.speechBubble}>
            <Textarea 
              placeholder="登録したい言葉" 
              className={styles.wordInputOverride}
              value={word}
              onChange={(e) => setWord(e.target.value)}
              rows={3}
            />
          </div>
          <img src="/piggy_bank.png" alt="貯金箱" className={styles.piggyImg} />
        </div>
        <Button size="lg" className={styles.registerButton} onClick={handleRegister}>
          登録する
        </Button>
      </section>

      {/* リスト表示 */}
      <section className={styles.listSection}>
        {professors.map((prof) => {
          const filteredVocabs = vocabList.filter(v => v.email_list_id === prof.id);
          if (filteredVocabs.length === 0) return null;

          return (
            <Card key={prof.id} className={styles.profListGroup}>
              <CardHeader className={styles.listHeader}>
                <img src={prof.avatar_url} alt="icon" className={styles.avatarMicro} />
                <CardTitle className={styles.listLabel}>{prof.name}</CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          );
        })}

        {hasAnyVocab && (
          <div className={styles.actionButtons}>
            <Button 
              size="sm" 
              className={styles.subButtonOverride} 
              onClick={handleCopy}
            >
              登録する
            </Button>
            <Button 
              size="sm" 
              className={styles.subButtonOverride} 
              onClick={handleDelete}
            >
              削除する
            </Button>
          </div>
        )}
      </section>
      </main>

      {/* ランクアップ */}
      {showRankModal && currentRank && (
        <div className={styles.modalOverlay} onClick={() => setShowRankModal(false)}>
          <Card className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className={styles.modalTitle}>ランクアップ！</CardTitle>
            </CardHeader>
            <CardContent>
              <img src={currentRank.image_url} alt={currentRank.content} className={styles.rankImg} />
              <p className={styles.modalText}>
                あなたの知性は <strong>{currentRank.content}</strong> になりました！
              </p>
              <Button onClick={() => setShowRankModal(false)}>閉じる</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
