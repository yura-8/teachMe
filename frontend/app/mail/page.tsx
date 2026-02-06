"use client";

import { useEffect, useMemo, useState } from "react";
import { Send, ChevronDown, ChevronUp, Trash2, X } from "lucide-react";
import styles from "./mail.module.css";
import PageMenu, { type PageMenuItem } from "@/components/PageMenu";

// --- Types ---
type Recipient = {
  id: number;
  user_id: number;
  name: string;
  email: string;
  avatar_url?: string;
};

type MyEmail = {
  id: number;
  user_id: number;
  email: string;
};

type Signature = {
  id: number;
  user_id: number;
  content: string;
};

type Template = {
  id: number;
  user_id: number;
  content: string;
  email_list_id: number;
  my_email_list_id: number;
  created_at: string;
  updated_at: string;
};

type SentMail = {
  id: number;
  content: string;
  email_list_id: number;
  my_email_list_id: number;
  user_id: number;
  created_at: string;
  to_email?: string;
  from_email?: string;
};

type IconPreset = {
  name: string;
  url: string;
};

const API_BASE = "http://localhost:8080";
const TEMPLATE_MARKER = "{{BODY}}";

// --- Helpers ---
const isProbablyEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

function countExactMarker(s: string) {
  return (s.match(/{{BODY}}/g) || []).length;
}
function countMarkerPrefix(s: string) {
  return (s.match(/{{BODY/g) || []).length;
}
function validateTemplateOrThrow(content: string) {
  const c = content.trim();
  if (!c) throw new Error("テンプレが空です");
  const exact = countExactMarker(c);
  const prefix = countMarkerPrefix(c);
  if (prefix !== exact) {
    throw new Error("不正なプレースホルダがあります。{{BODY}} を正しい形で1つだけ入れてください。");
  }
  if (exact !== 1) {
    throw new Error(`{{BODY}} は1つだけ必要です（現在: ${exact} 個）`);
  }
}

function splitTemplate(tpl: string) {
  const idx = tpl.indexOf(TEMPLATE_MARKER);
  if (idx < 0) return { pre: "", post: "" };
  const pre = tpl.slice(0, idx);
  const post = tpl.slice(idx + TEMPLATE_MARKER.length);
  return { pre, post };
}

function extractRawFromTemplatedBody(currentBody: string, activeTpl: string | null) {
  if (!activeTpl) return currentBody;
  if (!activeTpl.includes(TEMPLATE_MARKER)) return currentBody;
  const { pre, post } = splitTemplate(activeTpl);
  if (currentBody.startsWith(pre) && currentBody.endsWith(post)) {
    return currentBody.slice(pre.length, currentBody.length - post.length);
  }
  return currentBody;
}

function applyTemplate(tpl: string, raw: string) {
  if (!tpl.includes(TEMPLATE_MARKER)) return `${tpl}\n\n${raw}`;
  const { pre, post } = splitTemplate(tpl);
  return `${pre}${raw}${post}`;
}

export default function MailConfirmPage() {
  const menuItems: PageMenuItem[] = [
    { label: "文章生成", href: "/generate" },
    { label: "メール作成", href: "/mail" },
    { label: "語彙力貯金", href: "/vocabulary" },
    { label: "語彙力判定", href: "/goiryoku" },
    { label: "ログアウト", href: "/logout" },
  ];

  // Provider不要の方法でユーザーEmailを管理
  const [userEmail, setUserEmail] = useState("");

  // コンポーネント起動時にAPIからセッション情報を取得
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        if (data?.user?.email) {
          setUserEmail(data.user.email);
        }
      } catch (e) {
        console.error("Session fetch failed", e);
      }
    };
    fetchSession();
  }, []);

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [myEmails, setMyEmails] = useState<MyEmail[]>([]);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [busy, setBusy] = useState(false);

  const [toEmailInput, setToEmailInput] = useState("");
  const [fromEmailInput, setFromEmailInput] = useState("");
  const [signatureInput, setSignatureInput] = useState("");

  const [body, setBody] = useState("ここに生成された文章が入ります。適宜手直ししてください。");
  const [subject, setSubject] = useState("");

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("mail_draft_data");
      if (stored) {
        const data = JSON.parse(stored);
        if (data.subject) setSubject(data.subject);
        if (data.body) setBody(data.body);
        if (data.to) setToEmailInput(data.to);
        if (data.from) setFromEmailInput(data.from);
        
        // 読み込み後はクリアして、リロード時の誤作動を防ぐ（お好みでコメントアウト可）
        sessionStorage.removeItem("mail_draft_data");
      }
    } catch (e) {
      console.error("Failed to load draft from session storage", e);
    }
  }, []);

  // UI Toggles
  const [openTo, setOpenTo] = useState(false);
  const [openFrom, setOpenFrom] = useState(false);
  const [openSig, setOpenSig] = useState(false);
  const [showRecipientMeta, setShowRecipientMeta] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showTemplateArea, setShowTemplateArea] = useState(false);
  const [openTpl, setOpenTpl] = useState(false);

  // New Recipient Inputs
  const [pendingToEmail, setPendingToEmail] = useState("");
  const [pendingToName, setPendingToName] = useState("");
  const [pendingToAvatarMode, setPendingToAvatarMode] = useState<
    "auto" | "url" | "preset"
  >("auto");
  const [pendingToAvatarUrl, setPendingToAvatarUrl] = useState("");
  const [pendingToAvatarPreset, setPendingToAvatarPreset] =
    useState("/default.png");
  const [iconPresets, setIconPresets] = useState<IconPreset[]>([]);
  const [iconPresetsLoading, setIconPresetsLoading] = useState(false);
  const [iconPresetsError, setIconPresetsError] = useState<string | null>(null);

  // History State
  const [history, setHistory] = useState<SentMail[]>([]);
  const [historyScope, setHistoryScope] = useState<"selected" | "all">("selected");
  const [historySort, setHistorySort] = useState<"desc" | "asc">("desc");
  const [historyLimit, setHistoryLimit] = useState(50);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Template State
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateInput, setTemplateInput] = useState(
    `お世話になっております。\n\n${TEMPLATE_MARKER}\n\n何卒よろしくお願いいたします。`
  );
  const [activeTemplateId, setActiveTemplateId] = useState<number | null>(null);
  const [activeTemplateContent, setActiveTemplateContent] = useState<string | null>(null);

  // Derived Values
  const selectedRecipient = useMemo(() => {
    const email = toEmailInput.trim().toLowerCase();
    return recipients.find((r) => r.email.trim().toLowerCase() === email);
  }, [recipients, toEmailInput]);

  const avatarUrl = selectedRecipient?.avatar_url || "https://api.dicebear.com/7.x/pixel-art/svg?seed=Teacher";
  
  const selectedRecipientName = useMemo(() => {
    if (selectedRecipient?.name?.trim()) return selectedRecipient.name;
    if (toEmailInput.trim()) return "（新しい宛先）";
    return "宛先を入力してください";
  }, [selectedRecipient, toEmailInput]);

  const apiFetch = async (path: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers);
    if (userEmail) {
      headers.set("X-User-Email", userEmail);
    }
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    return fetch(`${API_BASE}${path}`, { ...options, headers });
  };

  const refetchAll = async () => {
    // ログインしていなければ何もしない
    if (!userEmail) return;

    setRecipients([]);
    setMyEmails([]);
    setSignatures([]);
    // setToEmailInput(""); 
    // setFromEmailInput(userEmail); // 後で制御する
    // setSignatureInput("");
    setHistory([]);

    try {
      const [emailsRes, myEmailsRes, sigsRes] = await Promise.all([
        apiFetch(`/emails`),
        apiFetch(`/my-emails`),
        apiFetch(`/signatures`),
      ]);

      const emailsData = (await emailsRes.json()) as Recipient[];
      const myEmailsData = (await myEmailsRes.json()) as MyEmail[];
      const sigsData = (await sigsRes.json()) as Signature[];

      let finalMyEmails = Array.isArray(myEmailsData) ? myEmailsData : [];

      if (userEmail) {
        const alreadyExists = finalMyEmails.some(
          (m) => m.email.trim().toLowerCase() === userEmail.trim().toLowerCase()
        );
        if (!alreadyExists) {
          try {
            // 保存APIを叩く
            const saveRes = await apiFetch(`/my-emails`, { 
              method: "POST", 
              body: JSON.stringify({ email: userEmail }) 
            });
            if (saveRes.ok) {
              const savedMyEmail = await saveRes.json();
              finalMyEmails.push(savedMyEmail); // リストに追加して送信時にエラーにならないようにする
              console.log("Logged-in email auto-saved:", savedMyEmail);
            }
          } catch(e) {
            console.error("Auto-save failed", e);
          }
        }
      }

      setRecipients(Array.isArray(emailsData) ? emailsData : []);
      setMyEmails(finalMyEmails);
      setSignatures(Array.isArray(sigsData) ? sigsData : []);

      if (!toEmailInput && Array.isArray(emailsData) && emailsData.length > 0) {
        setToEmailInput(emailsData[0].email);
      }
      if (!fromEmailInput) {
        setFromEmailInput(userEmail);
      }
      
      if (!signatureInput && Array.isArray(sigsData) && sigsData.length > 0) {
        setSignatureInput(sigsData[0].content);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // userEmail が取得できたらデータを読み込む
  useEffect(() => {
    if (userEmail) {
      refetchAll().catch((e) => console.error(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail]);

  const loadIconPresets = async () => {
    if (iconPresetsLoading) return;
    try {
      setIconPresetsLoading(true);
      setIconPresetsError(null);
      const res = await fetch("/api/icons", { method: "GET", cache: "no-store" });
      const data = await res.json().catch(() => null);
      const icons = Array.isArray(data?.icons) ? (data.icons as IconPreset[]) : [];
      setIconPresets(
        icons.filter((i) => typeof i?.url === "string" && typeof i?.name === "string"),
      );
    } catch (e) {
      setIconPresets([]);
      setIconPresetsError(e instanceof Error ? e.message : String(e));
    } finally {
      setIconPresetsLoading(false);
    }
  };

  useEffect(() => {
    if (!showRecipientMeta) return;
    if (iconPresets.length > 0) return;
    loadIconPresets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRecipientMeta]);

  useEffect(() => {
    if (!showRecipientMeta) return;
    if (pendingToAvatarMode !== "preset") return;
    if (iconPresets.length > 0) return;
    loadIconPresets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRecipientMeta, pendingToAvatarMode]);

  useEffect(() => {
    if (!showRecipientMeta) return;
    if (iconPresets.length === 0) return;
    setPendingToAvatarPreset((prev) =>
      iconPresets.some((p) => p.url === prev) ? prev : iconPresets[0].url,
    );
  }, [showRecipientMeta, iconPresets]);

  // --- Actions ---

  const saveRecipient = async () => {
    const email = toEmailInput.trim();
    if (!isProbablyEmail(email)) { alert("宛先のメール形式を確認してください"); return; }
    const exists = recipients.some((r) => r.email.trim().toLowerCase() === email.toLowerCase());
    if (exists) { alert("この宛先は既に登録されています"); return; }
    
    // 新規登録の準備
    setPendingToEmail(email);
    setPendingToName("");
    setPendingToAvatarMode("auto");
    setPendingToAvatarUrl("");
    setPendingToAvatarPreset("/default.png");
    setShowRecipientMeta(true);
    loadIconPresets();
    setOpenTo(false);
  };

  const confirmSaveRecipient = async () => {
    const email = pendingToEmail.trim();
    if (!isProbablyEmail(email)) { alert("宛先のメール形式を確認してください"); return; }
    const exists = recipients.some((r) => r.email.trim().toLowerCase() === email.toLowerCase());
    if (exists) { alert("この宛先は既に登録されています"); setShowRecipientMeta(false); return; }

    const autoAvatarUrl = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(email)}`;
    const chosenAvatarUrl =
      pendingToAvatarMode === "url" && pendingToAvatarUrl.trim()
        ? pendingToAvatarUrl.trim()
        : pendingToAvatarMode === "preset"
          ? pendingToAvatarPreset
          : autoAvatarUrl;

    const payload = { 
      // user_id はバックエンドが X-User-Email から自動判定するので不要
      email, 
      name: pendingToName.trim(), 
      avatar_url: chosenAvatarUrl,
    };

    try {
      setBusy(true);
      const res = await apiFetch(`/emails`, { method: "POST", body: JSON.stringify(payload) });
      if (!res.ok) { const j = await res.json().catch(() => null); alert(j?.error || "失敗しました"); return; }
      setShowRecipientMeta(false);
      setToEmailInput(email);
      await refetchAll();
    } catch (e) { console.error(e); alert("保存に失敗しました"); } finally { setBusy(false); }
  };

  const saveMyEmail = async () => {
    const email = fromEmailInput.trim();
    if (!isProbablyEmail(email)) { alert("メール形式を確認してください"); return; }
    const exists = myEmails.some((m) => m.email.trim().toLowerCase() === email.toLowerCase());
    if (exists) { alert("既に登録されています"); return; }

    try {
      setBusy(true);
      const res = await apiFetch(`/my-emails`, { method: "POST", body: JSON.stringify({ email }) });
      if (!res.ok) { const j = await res.json().catch(() => null); alert(j?.error || "失敗しました"); return; }
      await refetchAll();
    } catch (e) { console.error(e); alert("保存に失敗しました"); } finally { setBusy(false); }
  };

  const saveSignature = async () => {
    const content = signatureInput.trim();
    if (!content) { alert("署名が空です"); return; }
    const exists = signatures.some((s) => s.content.trim() === content);
    if (exists) { alert("既に登録されています"); return; }

    try {
      setBusy(true);
      const res = await apiFetch(`/signatures`, { method: "POST", body: JSON.stringify({ content }) });
      if (!res.ok) { const j = await res.json().catch(() => null); alert(j?.error || "失敗しました"); return; }
      await refetchAll();
    } catch (e) { console.error(e); alert("保存に失敗しました"); } finally { setBusy(false); }
  };

  const deleteItem = async (type: 'emails' | 'my-emails' | 'signatures', id: number) => {
    try {
      setBusy(true);
      const res = await apiFetch(`/${type}/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) { const j = await res.json().catch(() => null); alert(j?.error || "削除失敗"); return; }
      await refetchAll();
    } catch (e) { console.error(e); alert("削除失敗"); } finally { setBusy(false); }
  };

  // --- Templates ---
  const fetchTemplates = async () => {
    const recipient = recipients.find((r) => r.email.trim().toLowerCase() === toEmailInput.trim().toLowerCase());
    const my = myEmails.find((m) => m.email.trim().toLowerCase() === fromEmailInput.trim().toLowerCase());
    if (!recipient || !my) { setTemplates([]); return; }
    try {
      const res = await apiFetch(`/templates?email_list_id=${recipient.id}&my_email_list_id=${my.id}`);
      if (!res.ok) return;
      setTemplates(await res.json());
    } catch {}
  };

  useEffect(() => { if (showTemplateArea) fetchTemplates(); }, [showTemplateArea, toEmailInput, fromEmailInput, recipients, myEmails, userEmail]);

  const handleApplyTemplate = (tpl: Template) => {
    try { validateTemplateOrThrow(tpl.content); } catch (e: any) { alert(e.message); return; }
    const raw = extractRawFromTemplatedBody(body, activeTemplateContent);
    setBody(applyTemplate(tpl.content, raw));
    setActiveTemplateId(tpl.id);
    setActiveTemplateContent(tpl.content);
    setOpenTpl(false);
  };

  const saveTemplate = async () => {
    try { validateTemplateOrThrow(templateInput.trim()); } catch (e: any) { alert(e.message); return; }
    const recipient = recipients.find((r) => r.email.trim().toLowerCase() === toEmailInput.trim().toLowerCase());
    const my = myEmails.find((m) => m.email.trim().toLowerCase() === fromEmailInput.trim().toLowerCase());
    if (!recipient || !my) { alert("宛先と送信元を選んでください"); return; }

    try {
      setBusy(true);
      const res = await apiFetch(`/templates`, {
        method: "POST",
        body: JSON.stringify({ content: templateInput.trim(), email_list_id: recipient.id, my_email_list_id: my.id })
      });
      if (!res.ok) { const j = await res.json().catch(() => null); alert(j?.error || "保存失敗"); return; }
      
      const created: Template = await res.json();
      const raw = extractRawFromTemplatedBody(body, activeTemplateContent);
      setBody(applyTemplate(created.content, raw));
      setActiveTemplateId(created.id);
      setActiveTemplateContent(created.content);
      setOpenTpl(false);
      await fetchTemplates();
      alert("テンプレを保存し適用しました");
    } catch (e) { console.error(e); alert("保存失敗"); } finally { setBusy(false); }
  };

  const deleteTemplate = async (id: number) => {
    try {
      setBusy(true);
      const res = await apiFetch(`/templates/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) { const j = await res.json().catch(() => null); alert(j?.error || "削除失敗"); return; }
      if (activeTemplateId === id) {
        setBody(extractRawFromTemplatedBody(body, activeTemplateContent));
        setActiveTemplateId(null);
        setActiveTemplateContent(null);
      }
      await fetchTemplates();
    } catch (e) { console.error(e); alert("削除失敗"); } finally { setBusy(false); }
  };

  // --- Send & History ---
  const handleSendAndSave = async () => {
    const toEmail = toEmailInput.trim().toLowerCase();
    const fromEmail = fromEmailInput.trim().toLowerCase();
    if (!isProbablyEmail(toEmail) || !isProbablyEmail(fromEmail)) { alert("メール形式を確認してください"); return; }

    const recipient = recipients.find((r) => r.email.trim().toLowerCase() === toEmail);
    const my = myEmails.find((m) => m.email.trim().toLowerCase() === fromEmail);
    if (!recipient || !my) { alert("宛先または送信元を「保存」してください"); return; }

    const fullMessage = signatureInput.trim() ? `${body}\n\n${signatureInput}` : body;

    try {
      setBusy(true);
      const res = await apiFetch(`/sent`, {
        method: "POST",
        body: JSON.stringify({
          content: `件名：${subject}\n\n${fullMessage}`,
          email_list_id: recipient.id,
          my_email_list_id: my.id
        })
      });

      if (res.ok) {
        alert("送信履歴を記録しました！");
        if (showHistory) await fetchHistory();
      } else {
        const j = await res.json().catch(() => null);
        alert(j?.error || "履歴保存に失敗しました");
      }
    } catch (e) { console.error(e); alert("送信エラー"); } finally { setBusy(false); }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const recipient = recipients.find((r) => r.email?.trim().toLowerCase() === toEmailInput.trim().toLowerCase());
      const my = myEmails.find((m) => m.email?.trim().toLowerCase() === fromEmailInput.trim().toLowerCase());
      const params = new URLSearchParams({ sort: historySort, limit: String(historyLimit) });
      if (historyQuery.trim()) params.set("q", historyQuery.trim());
      if (historyScope === "selected") {
        if (recipient) params.set("email_list_id", String(recipient.id));
        if (my) params.set("my_email_list_id", String(my.id));
      }
      const res = await apiFetch(`/sent?${params.toString()}`);
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `エラーが発生しました (Status: ${res.status})`);
      }
      
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);

    } catch (e: any) { 
      console.error(e);
      setHistoryError(e.message || "履歴の取得に失敗しました"); 
      setHistory([]); 
    }
    finally { setHistoryLoading(false); }
  };

  useEffect(() => {
    if (showHistory) fetchHistory();
  }, [showHistory, historyScope, historySort, historyLimit, historyQuery, toEmailInput, fromEmailInput, recipients, myEmails, userEmail]);

  // --- Render ---
  return (
    <div className={styles.wrapper}>
      <PageMenu items={menuItems} className="fixed left-4 top-4 z-50" />
      <div className={styles.container}>
        
        {/* Header Title (Grid full width) */}
        <div className={styles.header}>
          <div className={styles.title}>メール作成</div>
          <button
            className={styles.actionBtn}
            onClick={() => setShowHistory((v) => !v)}
          >
            {showHistory ? "履歴を閉じる" : "履歴を見る"}
          </button>
        </div>

        {/* Left Panel */}
        <div className={styles.leftPanel}>
          <div className={styles.card}>
            <div className={styles.recipientInfo}>
              <img src={avatarUrl} alt="avatar" className={styles.avatar} />
              <div className={styles.infoText}>
                <h3>{selectedRecipientName}</h3>
                <p>{selectedRecipient?.email || toEmailInput || "未入力"}</p>
              </div>
            </div>
          </div>

          {showHistory && (
            <div className={styles.card}>
              <div className={styles.row} style={{ justifyContent: 'space-between' }}>
                <span className={styles.label}>送信履歴</span>
                <button onClick={fetchHistory} className={styles.actionBtn} style={{height: 32, padding: '0 12px', fontSize: 12}}>
                  更新
                </button>
              </div>
              
              <div className={styles.row} style={{ marginTop: 12 }}>
                <select className={styles.select} value={historyScope} onChange={(e: any) => setHistoryScope(e.target.value)}>
                  <option value="selected">現在の宛先</option>
                  <option value="all">全て</option>
                </select>
              </div>

              <div className={styles.row} style={{ marginTop: 8 }}>
                <input className={styles.input} placeholder="検索" value={historyQuery} onChange={(e) => setHistoryQuery(e.target.value)} />
              </div>

              {historyLoading && <div className={styles.textSmall} style={{marginTop:10}}>読み込み中...</div>}
              {historyError && <div style={{color:'red', fontSize:12, marginTop:10}}>{historyError}</div>}
              
              <div className={styles.historyList}>
                {history.map((m) => (
                  <div key={m.id} className={styles.historyItem}>
                    <div className={styles.historyDate}>
                      {new Date(m.created_at).toLocaleString()}
                    </div>

                    {/* Fromの表示 */}
                    <div style={{ fontSize: 12, color: "#666", marginBottom: 2 }}>
                      From: {m.from_email || "不明"}
                    </div>

                    <div style={{ fontSize: 12, color: "#666", marginBottom: 2 }}>
                      To: {m.to_email || "不明"}
                    </div>

                    {/* 折りたたみ表示 */}
                    <details style={{ marginTop: 4 }}>
                      <summary
                        style={{
                          cursor: "pointer",
                          color: "#555",
                          fontSize: "13px",
                          userSelect: "none",
                        }}
                      >
                        {m.content.split("\n")[0].slice(0, 40)}...{" "}
                        <span style={{ fontSize: 10, color: "#888" }}>(詳細)</span>
                      </summary>
                      <div
                        style={{
                          whiteSpace: "pre-wrap",
                          marginTop: 4,
                          color: "#333",
                          fontSize: "13px",
                          padding: "8px",
                          background: "#f9f9f9",
                          borderRadius: "4px",
                        }}
                      >
                        {m.content}
                      </div>
                    </details>
                  </div>
                ))}
                {!historyLoading && history.length === 0 && (
                  <div className={styles.textSmall}>履歴なし</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel (Main Form) */}
        <div className={styles.rightPanel}>
          <div className={styles.card}>
            <div className={styles.formGroup}>
              <div className={styles.row}>
                {/* 宛先入力 */}
                <div className={styles.relative} style={{ flex: 1 }}>
                  <label className={styles.label}>宛先 (To)</label>
                  <div className={styles.row} style={{ marginTop: 6 }}>
                    <input
                      className={styles.input}
                      placeholder="prof@univ.ac.jp"
                      value={toEmailInput}
                      onChange={(e) => setToEmailInput(e.target.value)}
                      onFocus={() => { setOpenTo(false); setShowRecipientMeta(false); }}
                    />
                    <button className={styles.iconBtn} onClick={() => setOpenTo(!openTo)}>
                      {openTo ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                    </button>
                    <button className={styles.actionBtn} onClick={saveRecipient} disabled={busy}>保存</button>
                  </div>

                  {openTo && (
                    <div className={styles.dropdown}>
                      {recipients.map(r => (
                        <div key={r.id} className={styles.dropdownItem}>
                          <div onClick={() => { setToEmailInput(r.email); setOpenTo(false); }}>
                            <div style={{fontWeight:600}}>{r.email}</div>
                            <div className={styles.textSmall}>{r.name}</div>
                          </div>
                          <button onClick={() => deleteItem('emails', r.id)}><Trash2 size={16} color="#d32f2f"/></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 送信元入力 */}
                <div className={styles.relative} style={{ flex: 1 }}>
                  <label className={styles.label}>送信元 (From)</label>
                  <div className={styles.row} style={{ marginTop: 6 }}>
                    <input
                      className={styles.input}
                      placeholder="me@example.com"
                      value={fromEmailInput}
                      onChange={(e) => setFromEmailInput(e.target.value)}
                      onFocus={() => setOpenFrom(false)}
                    />
                    <button className={styles.iconBtn} onClick={() => setOpenFrom(!openFrom)}>
                      {openFrom ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                    </button>
                    <button className={styles.actionBtn} onClick={saveMyEmail} disabled={busy}>保存</button>
                  </div>
                  {openFrom && (
                    <div className={styles.dropdown}>
                      {myEmails.map(m => (
                        <div key={m.id} className={styles.dropdownItem}>
                          <div onClick={() => { setFromEmailInput(m.email); setOpenFrom(false); }}>
                            {m.email}
                          </div>
                          <button onClick={() => deleteItem('my-emails', m.id)}><Trash2 size={16} color="#d32f2f"/></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 新規宛先登録メタ情報（シンプル版） */}
              {showRecipientMeta && (
                <div className={styles.metaBox}>
                  <div className={styles.row} style={{ justifyContent:'space-between', marginBottom:10 }}>
                    <span className={styles.label}>新規登録: {pendingToEmail}</span>
                    <button onClick={() => setShowRecipientMeta(false)}><X size={18}/></button>
                  </div>
                  <div className={styles.row} style={{ gap: 10, alignItems: "flex-start" }}>
                    <div style={{ flex: 1, display: "grid", gap: 8 }}>
                      <input className={styles.input} placeholder="名前 (例: 田中教授)" value={pendingToName} onChange={e => setPendingToName(e.target.value)} />

                      <div style={{ display: "grid", gap: 6 }}>
                        <div className={styles.textSmall} style={{ fontWeight: 600 }}>アイコン</div>
                        <div className={styles.row} style={{ gap: 10 }}>
                          <label className={styles.textSmall}>
                            <input
                              type="radio"
                              name="pendingAvatarMode"
                              checked={pendingToAvatarMode === "auto"}
                              onChange={() => setPendingToAvatarMode("auto")}
                            />{" "}
                            自動生成
                          </label>
                          <label className={styles.textSmall}>
                            <input
                              type="radio"
                              name="pendingAvatarMode"
                              checked={pendingToAvatarMode === "preset"}
                              onChange={() => setPendingToAvatarMode("preset")}
                            />{" "}
                            プリセット
                          </label>
                          <label className={styles.textSmall}>
                            <input
                              type="radio"
                              name="pendingAvatarMode"
                              checked={pendingToAvatarMode === "url"}
                              onChange={() => setPendingToAvatarMode("url")}
                            />{" "}
                            URL指定
                          </label>
                        </div>

                        {pendingToAvatarMode === "preset" ? (
                          <select
                            className={styles.select}
                            value={pendingToAvatarPreset}
                            onChange={(e) => setPendingToAvatarPreset(e.target.value)}
                          >
                            {iconPresets.length > 0 ? (
                              iconPresets.map((p) => (
                                <option key={p.url} value={p.url}>
                                  {p.name}
                                </option>
                              ))
                            ) : (
                              <option value="/default.png">
                                {iconPresetsLoading
                                  ? "（読み込み中…）"
                                  : "（icons が見つかりません）"}{" "}
                                default.png
                              </option>
                            )}
                          </select>
                        ) : null}

                        {pendingToAvatarMode === "url" ? (
                          <input
                            className={styles.input}
                            placeholder="https://... (画像URL)"
                            value={pendingToAvatarUrl}
                            onChange={(e) => setPendingToAvatarUrl(e.target.value)}
                          />
                        ) : null}
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: 8, justifyItems: "center" }}>
                      <img
                        src={
                          pendingToAvatarMode === "url" && pendingToAvatarUrl.trim()
                            ? pendingToAvatarUrl.trim()
                            : pendingToAvatarMode === "preset"
                              ? pendingToAvatarPreset
                              : `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(pendingToEmail)}`
                        }
                        alt="preview"
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 14,
                          border: "1px solid rgba(0,0,0,0.1)",
                          background: "#fff",
                          objectFit: "cover",
                        }}
                      />
                      <button className={styles.actionBtn} onClick={confirmSaveRecipient} disabled={busy}>登録</button>
                    </div>
                  </div>
                  <div className={styles.textSmall} style={{marginTop:8}}>
                    ※ 画像は URL 指定 or プリセットから選択できます（未指定なら自動生成）
                    {iconPresetsError ? (
                      <div style={{ marginTop: 6, color: "#d32f2f" }}>
                        アイコン一覧の読み込みに失敗しました: {iconPresetsError}
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            <div className={styles.formGroup} style={{ marginTop: 20 }}>
              <label className={styles.label}>件名</label>
              <input 
                className={styles.input} 
                placeholder="例）【欠席連絡】体調不良のため"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div className={styles.formGroup} style={{ marginTop: 20 }}>
              <label className={styles.label}>本文</label>
              <textarea 
                className={styles.textarea} 
                style={{ minHeight: 200 }}
                placeholder="本文を入力してください"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>

            <div className={styles.formGroup} style={{ marginTop: 20 }}>
              <div className={styles.relative}>
                <label className={styles.label}>署名 (任意)</label>
                <div className={styles.row} style={{ marginTop: 6, alignItems:'flex-start' }}>
                  <textarea 
                    className={styles.textarea} 
                    style={{ minHeight: 80 }}
                    placeholder={"例）\n○○大学 ○○学科\n氏名：..."}
                    value={signatureInput}
                    onChange={(e) => setSignatureInput(e.target.value)}
                    onFocus={() => setOpenSig(false)}
                  />
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    <button className={styles.actionBtn} onClick={saveSignature} disabled={busy}>保存</button>
                    <button className={styles.iconBtn} onClick={() => setOpenSig(!openSig)}>
                      {openSig ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                    </button>
                  </div>
                </div>
                {openSig && (
                  <div className={styles.dropdown}>
                    {signatures.map(s => (
                      <div key={s.id} className={styles.dropdownItem}>
                        <div onClick={() => { setSignatureInput(s.content); setOpenSig(false); }} style={{whiteSpace:'pre-wrap', fontSize:12}}>
                          {s.content}
                        </div>
                        <button onClick={() => deleteItem('signatures', s.id)}><Trash2 size={16} color="#d32f2f"/></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* テンプレエリア */}
            <div style={{ marginTop: 20 }}>
              <button 
                className={styles.actionBtn} 
                style={{ background: '#fff', border: '1px solid #ddd' }}
                onClick={() => setShowTemplateArea(!showTemplateArea)}
              >
                {showTemplateArea ? "テンプレを閉じる" : "▼ テンプレを使う"}
              </button>

              {showTemplateArea && (
                <div className={styles.metaBox} style={{ marginTop: 10 }}>
                  <div className={styles.relative}>
                    <textarea 
                      className={styles.textarea} 
                      style={{ minHeight: 100 }}
                      value={templateInput}
                      onChange={(e) => setTemplateInput(e.target.value)}
                      onFocus={() => setOpenTpl(false)}
                    />
                    <div className={styles.row} style={{ marginTop: 8 }}>
                      <button className={styles.actionBtn} onClick={saveTemplate} disabled={busy}>この内容で登録</button>
                      <button className={styles.iconBtn} onClick={() => setOpenTpl(!openTpl)}>
                        {openTpl ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                      </button>
                    </div>
                    
                    {openTpl && (
                       <div className={styles.dropdown} style={{ bottom: '100%', top: 'auto', marginBottom: 8 }}>
                         {templates.map(t => (
                           <div key={t.id} className={styles.dropdownItem}>
                             <div onClick={() => handleApplyTemplate(t)} style={{whiteSpace:'pre-wrap', fontSize:12, flex:1}}>
                               {t.content.slice(0,80)}...
                             </div>
                             <button onClick={() => deleteTemplate(t.id)}><Trash2 size={16} color="#d32f2f"/></button>
                           </div>
                         ))}
                       </div>
                    )}
                  </div>
                  <div className={styles.textSmall} style={{marginTop:8}}>※ {TEMPLATE_MARKER} の部分に本文が挿入されます</div>
                </div>
              )}
            </div>

            <button className={styles.sendButton} onClick={handleSendAndSave} disabled={busy}>
              <Send size={20} />
              送信履歴に記録する
            </button>
            <div className={styles.textSmall} style={{ textAlign:'center', marginTop:8 }}>
              ※ 宛先・送信元が未保存の場合は押せません
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
