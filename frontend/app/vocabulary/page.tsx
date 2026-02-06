"use client";

import { useMemo, useState, useEffect, useRef } from "react";
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
  email?: string;
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
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [vocabList, setVocabList] = useState<Vocabulary[]>([]);
  const [selectedIDs, setSelectedIDs] = useState<number[]>([]);

  const [currentUserID, setCurrentUserID] = useState<number | null>(null);
  const [currentUserError, setCurrentUserError] = useState<string | null>(null);
  const [selectedProfID, setSelectedProfID] = useState<number | null>(null);

  const [isProfMenuOpen, setIsProfMenuOpen] = useState(false);

  const [showRankModal, setShowRankModal] = useState(false);
  const [currentRank, setCurrentRank] = useState<{content: string, image_url: string} | null>(null);
  const [lastRankID, setLastRankID] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const profMenuRef = useRef<HTMLDivElement>(null);

  const userToProfessor = (u: UserRow): Professor => ({
    id: u.id,
    email: u.email,
    name: u.name?.trim() || u.email?.split("@")[0] || `ユーザー#${u.id}`,
    avatar_url:
      u.avatar_url?.trim() ||
      `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(
        u.email || String(u.id),
      )}`,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profMenuRef.current && !profMenuRef.current.contains(event.target as Node)) {
        setIsProfMenuOpen(false);
      }
    };
    if (isProfMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isProfMenuOpen]);

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

        const userRows = Array.isArray(users) ? users : [];
        const profRows = userRows.filter((u) => typeof u?.id === "number" && u.id !== me.id);
        const profs = (profRows.length > 0 ? profRows : userRows).map(userToProfessor);
        setProfessors(profs);
        setSelectedProfID((prev) => {
          if (typeof prev === "number" && profs.some((p) => p.id === prev)) return prev;
          return profs.length > 0 ? profs[0].id : null;
        });
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
    if (!selectedProfID) {
      setCurrentUserError("登録先ユーザーを選択してください。");
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
    if (!selectedProfID) {
      setCurrentUserError("コピー先ユーザーを選択してください。");
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

  const effectiveProfessors = useMemo(() => {
    const list = Array.isArray(professors) ? professors : [];
    if (!Array.isArray(vocabList)) return list;

    const known = new Set(list.map((p) => p.id));
    const extraIDs = Array.from(new Set(vocabList.map((v) => v.email_list_id))).filter(
      (id) => typeof id === "number" && !known.has(id),
    );
    if (extraIDs.length === 0) return list;

    const extra: Professor[] = extraIDs.map((id) => ({
      id,
      name: `ユーザー#${id}`,
      avatar_url: "/default.png",
      email: undefined,
    }));
    return [...list, ...extra];
  }, [professors, vocabList]);

  const currentProf =
    (typeof selectedProfID === "number"
      ? effectiveProfessors.find((p) => p.id === selectedProfID)
      : undefined) || effectiveProfessors[0];
  const hasAnyVocab = Array.isArray(vocabList) && vocabList.length > 0;

  return (
    <div className={styles.container}>
      <PageMenu items={menuItems} className="fixed left-4 top-4 z-50" />
      {/* 選択中の教授バッジ & セレクトメニュー */}
      <div className={styles.currentProfSelector} ref={profMenuRef}>
        <div 
          className={styles.profBadge} 
          onClick={() => setIsProfMenuOpen(!isProfMenuOpen)}
          style={{ cursor: "pointer" }}
        >
          <img
            src={currentProf?.avatar_url || "/default.png"}
            alt="icon"
            className={styles.avatarMini}
          />
          <span className={styles.profNameLabel}>
            {currentProf?.name || "ユーザー未選択"}
          </span>
          <span className={styles.profArrow}>▼</span>
        </div>

        {isProfMenuOpen && (
          <Card className={styles.profDropdown}>
            {effectiveProfessors.map((p) => (
              <div 
                key={p.id} 
                className={styles.profOption}
                onClick={() => {
                  setSelectedProfID(p.id);
                  setIsProfMenuOpen(false);
                }}
              >
                <img src={p.avatar_url} alt="" className={styles.avatarMicro} />
                <div style={{ display: "grid" }}>
                  <span>{p.name}</span>
                  {p.email ? (
                    <span style={{ fontSize: 11, opacity: 0.7 }}>{p.email}</span>
                  ) : null}
                </div>
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
        {effectiveProfessors.map((prof) => {
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
