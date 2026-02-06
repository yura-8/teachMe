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

type SessionResponse = {
  user?: {
    email?: string;
  };
};

type UserRow = {
  id: number;
  email: string;
  name?: string;
  avatar_url?: string;
  rank_id?: number;
};

interface Professor {
  id: number;
  name: string;
  avatar_url: string;
}

export default function VocabularyPage() {
  const menuItems: PageMenuItem[] = [
    { label: "文章生成", href: "/generate" },
    { label: "メール作成", href: "/mail" },
    { label: "語彙力貯金", href: "/vocabulary" },
    { label: "語彙力判定", href: "/goiryoku" },
    { label: "ログアウト", href: "/logout" },
  ];

  const [word, setWord] = useState("");
  const [professors, setProfessors] = useState<Professor[]>([
    { id: 101, name: "神部 教授", avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=prof1" },
    { id: 202, name: "佐藤 教授", avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=prof2" },
  ]);
  const [vocabList, setVocabList] = useState<Vocabulary[]>([]);
  const [selectedIDs, setSelectedIDs] = useState<number[]>([]);

  const [currentUserID, setCurrentUserID] = useState<number | null>(null);
  const [currentUserError, setCurrentUserError] = useState<string | null>(null);
  const [selectedProfID, setSelectedProfID] = useState(101);

  const [isProfMenuOpen, setIsProfMenuOpen] = useState(false);

  const [showRankModal, setShowRankModal] = useState(false);
  const [currentRank, setCurrentRank] = useState<{content: string, image_url: string} | null>(null);
  const [lastRankID, setLastRankID] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setCurrentUserError(null);
        const sessionRes = await fetch("/api/auth/session");
        const session = (await sessionRes.json().catch(() => ({}))) as SessionResponse;
        const email = session?.user?.email ?? "";
        if (!email) {
          if (!cancelled) {
            setCurrentUserID(null);
            setCurrentUserError("ログインしてください（ユーザー情報が取得できません）。");
          }
          return;
        }

        const usersRes = await fetch("/api/users");
        const users = (await usersRes.json().catch(() => [])) as UserRow[];
        const me = Array.isArray(users) ? users.find((u) => u.email === email) : undefined;
        if (!me) {
          if (!cancelled) {
            setCurrentUserID(null);
            setCurrentUserError("ログインユーザーがDBに見つかりませんでした。もう一度ログインしてください。");
          }
          return;
        }

        if (cancelled) return;
        setCurrentUserID(me.id);
        setLastRankID(typeof me.rank_id === "number" ? me.rank_id : null);
      } catch (err) {
        if (!cancelled) {
          setCurrentUserID(null);
          setCurrentUserError(err instanceof Error ? err.message : "ユーザー情報の取得に失敗しました。");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 語彙一覧を取得
  const fetchVocabularies = async () => {
    if (!currentUserID) return;
    try {
      const res = await fetch(`/api/vocabularies?user_id=${currentUserID}`);
      const data = await res.json().catch(() => null);
      setVocabList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch:", err);
      setVocabList([]);
    }
  };

  useEffect(() => {
    fetchVocabularies();
  }, [currentUserID]);

  // 新規登録
  const handleRegister = async () => {
    if (!word.trim()) return;
    if (!currentUserID) {
      setCurrentUserError("ログインユーザーが未確定のため登録できません。");
      return;
    }
    try {
      setBusy(true);
      setCurrentUserError(null);
      const res = await fetch("/api/vocabularies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: currentUserID,
          word: word,
          prof_id: selectedProfID,
        }),
      });
      const raw = await res.text().catch(() => "");
      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        const message =
          (data && (data.error || data.details)) ||
          (raw ? raw.slice(0, 200) : "") ||
          `登録に失敗しました (status ${res.status})`;
        setCurrentUserError(String(message));
        return;
      }
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
    } catch (err) {
      console.error(err);
      setCurrentUserError(err instanceof Error ? err.message : "登録に失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  // 削除機能
  const handleCheck = (id: number) => {
    setSelectedIDs(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleDelete = async () => {
    if (selectedIDs.length === 0) return;
    if (!currentUserID) {
      setCurrentUserError("ログインユーザーが未確定のため削除できません。");
      return;
    }
    try {
      const res = await fetch("/api/vocabularies", {
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
    if (!currentUserID) {
      setCurrentUserError("ログインユーザーが未確定のためコピーできません。");
      return;
    }
    try {
      const res = await fetch("/api/vocabularies/copy", {
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
  const hasAnyVocab = Array.isArray(vocabList) && vocabList.length > 0;

  return (
    <div className={styles.container}>
      <PageMenu items={menuItems} className="fixed left-4 top-4 z-50" />
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
        <Button
          size="lg"
          className={styles.registerButton}
          onClick={handleRegister}
          disabled={busy || !currentUserID || !word.trim()}
        >
          {busy ? "登録中..." : "登録する"}
        </Button>
        {currentUserError ? (
          <div style={{ marginTop: 12, color: "#a11", fontSize: 12 }}>
            {currentUserError}
          </div>
        ) : null}
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
              コピーする
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
