"use client";

import { useEffect, useMemo, useState } from "react";
import { Send, ChevronDown, ChevronUp, Trash2, X } from "lucide-react";

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

const API_BASE = "http://localhost:8080";
const TEMPLATE_MARKER = "{{BODY}}";

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
  // ★ 開発用: ユーザーID切り替え機能
  const [debugUserId, setDebugUserId] = useState(1);

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [myEmails, setMyEmails] = useState<MyEmail[]>([]);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [busy, setBusy] = useState(false);

  const [toEmailInput, setToEmailInput] = useState("");
  const [fromEmailInput, setFromEmailInput] = useState("");
  const [signatureInput, setSignatureInput] = useState("");

  // 本文（テンプレ適用時はこのテキストエリアが実際に置換される）
  const [body, setBody] = useState("ここに生成された文章が入ります。適宜手直ししてください。");
  const [subject, setSubject] = useState("");

  // dropdown open states
  const [openTo, setOpenTo] = useState(false);
  const [openFrom, setOpenFrom] = useState(false);
  const [openSig, setOpenSig] = useState(false);

  // new recipient meta (only when registering a new email)
  const [showRecipientMeta, setShowRecipientMeta] = useState(false);
  const [pendingToEmail, setPendingToEmail] = useState("");
  const [pendingToName, setPendingToName] = useState("");
  const [pendingToAvatar, setPendingToAvatar] = useState("");

  // history
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<SentMail[]>([]);
  const [historyScope, setHistoryScope] = useState<"selected" | "all">("selected");
  const [historySort, setHistorySort] = useState<"desc" | "asc">("desc");
  const [historyLimit, setHistoryLimit] = useState(50);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // templates (optional)
  const [showTemplateArea, setShowTemplateArea] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateInput, setTemplateInput] = useState(
    `お世話になっております。\n\n${TEMPLATE_MARKER}\n\n何卒よろしくお願いいたします。`
  );
  const [openTpl, setOpenTpl] = useState(false);

  // active template
  const [activeTemplateId, setActiveTemplateId] = useState<number | null>(null);
  const [activeTemplateContent, setActiveTemplateContent] = useState<string | null>(null);

  const selectedRecipient = useMemo(() => {
    const email = toEmailInput.trim().toLowerCase();
    return recipients.find((r) => r.email.trim().toLowerCase() === email);
  }, [recipients, toEmailInput]);
  

  const avatarUrl =
    selectedRecipient?.avatar_url || "https://api.dicebear.com/7.x/pixel-art/svg?seed=Teacher";

  const selectedRecipientName = selectedRecipient?.name?.trim() || "（未保存の宛先）";

  // ★ API Fetch Wrapper: debugUserId をヘッダーに付与
  const apiFetch = async (path: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers);
    headers.set("X-User-ID", String(debugUserId));
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    // path は '/emails' 等で渡す想定
    return fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  };

  const refetchAll = async () => {
    // ユーザー切り替え時にリセット
    setRecipients([]);
    setMyEmails([]);
    setSignatures([]);
    setToEmailInput("");
    setFromEmailInput("");
    setSignatureInput("");
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

      setRecipients(Array.isArray(emailsData) ? emailsData : []);
      setMyEmails(Array.isArray(myEmailsData) ? myEmailsData : []);
      setSignatures(Array.isArray(sigsData) ? sigsData : []);

      if (Array.isArray(emailsData) && emailsData.length > 0) setToEmailInput(emailsData[0].email);
      if (Array.isArray(myEmailsData) && myEmailsData.length > 0) setFromEmailInput(myEmailsData[0].email);
      if (Array.isArray(sigsData) && sigsData.length > 0) setSignatureInput(sigsData[0].content);
    } catch (e) {
      console.error(e);
    }
  };

  // debugUserId が変わるたびに再取得
  useEffect(() => {
    refetchAll().catch((e) => console.error(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debugUserId]);

  // ----------------------------
  // Save / Delete: Recipients
  // ----------------------------

  const saveRecipient = async () => {
    const email = toEmailInput.trim();
    if (!isProbablyEmail(email)) {
      alert("宛先のメール形式を確認してください");
      return;
    }

    const exists = recipients.some((r) => r.email.trim().toLowerCase() === email.toLowerCase());
    if (exists) {
      alert("この宛先は既に登録されています");
      return;
    }

    setPendingToEmail(email);
    setPendingToName("");
    setPendingToAvatar("");
    setShowRecipientMeta(true);
    setOpenTo(false);
  };

  const confirmSaveRecipient = async () => {
    const email = pendingToEmail.trim();
    if (!isProbablyEmail(email)) {
      alert("宛先のメール形式を確認してください");
      return;
    }

    const exists = recipients.some((r) => r.email.trim().toLowerCase() === email.toLowerCase());
    if (exists) {
      alert("この宛先は既に登録されています");
      setShowRecipientMeta(false);
      return;
    }

    const payload = {
      user_id: debugUserId, // ★ debugUserId を使用
      email,
      name: pendingToName.trim(),
      avatar_url: pendingToAvatar.trim(),
    };

    try {
      setBusy(true);
      const res = await apiFetch(`/emails`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => null);
        alert(j?.error || "宛先の保存に失敗しました");
        return;
      }

      setShowRecipientMeta(false);
      setToEmailInput(email);
      await refetchAll();
    } catch (e) {
      console.error(e);
      alert("宛先の保存に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const saveMyEmail = async () => {
    const email = fromEmailInput.trim();
    if (!isProbablyEmail(email)) {
      alert("送信元のメール形式を確認してください");
      return;
    }

    const exists = myEmails.some((m) => m.email.trim().toLowerCase() === email.toLowerCase());
    if (exists) {
      alert("この送信元は既に登録されています");
      return;
    }

    const payload = { user_id: debugUserId, email }; // ★ debugUserId

    try {
      setBusy(true);
      const res = await apiFetch(`/my-emails`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        alert("この送信元は既に登録されています");
        return;
      }

      if (!res.ok) {
        const j = await res.json().catch(() => null);
        alert(j?.error || "送信元の保存に失敗しました");
        return;
      }

      await refetchAll();
    } catch (e) {
      console.error(e);
      alert("送信元の保存に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const saveSignature = async () => {
    const content = signatureInput.trim();
    if (!content) {
      alert("署名が空です");
      return;
    }

    const exists = signatures.some((s) => s.content.trim() === content);
    if (exists) {
      alert("同じ署名が既に登録されています");
      return;
    }

    const payload = { user_id: debugUserId, content }; // ★ debugUserId

    try {
      setBusy(true);
      const res = await apiFetch(`/signatures`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        alert("同じ署名が既に登録されています");
        return;
      }

      if (!res.ok) {
        const j = await res.json().catch(() => null);
        alert(j?.error || "署名の保存に失敗しました");
        return;
      }

      await refetchAll();
    } catch (e) {
      console.error(e);
      alert("署名の保存に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  // ----------------------------
  // Templates
  // ----------------------------

  const fetchTemplates = async () => {
    const toEmail = toEmailInput.trim().toLowerCase();
    const fromEmail = fromEmailInput.trim().toLowerCase();
    const recipient = recipients.find((r) => r.email.trim().toLowerCase() === toEmail);
    const my = myEmails.find((m) => m.email.trim().toLowerCase() === fromEmail);

    if (!recipient || !my) {
      setTemplates([]);
      return;
    }

    try {
      const res = await apiFetch(
        `/templates?email_list_id=${recipient.id}&my_email_list_id=${my.id}`
      );
      if (!res.ok) return;
      const data: Template[] = await res.json();
      setTemplates(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!showTemplateArea) return;
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTemplateArea, toEmailInput, fromEmailInput, recipients, myEmails, debugUserId]);

  const handleApplyTemplate = (tpl: Template) => {
    const raw = extractRawFromTemplatedBody(body, activeTemplateContent);

    try {
      validateTemplateOrThrow(tpl.content);
    } catch (e: any) {
      alert(e.message || "テンプレが不正です");
      return;
    }

    setBody(applyTemplate(tpl.content, raw));
    setActiveTemplateId(tpl.id);
    setActiveTemplateContent(tpl.content);
    setOpenTpl(false);
  };

  const clearTemplate = () => {
    const raw = extractRawFromTemplatedBody(body, activeTemplateContent);
    setBody(raw);
    setActiveTemplateId(null);
    setActiveTemplateContent(null);
  };

  const saveTemplate = async () => {
    const content = templateInput.trim();

    try {
      validateTemplateOrThrow(content);
    } catch (e: any) {
      alert(e.message || "テンプレが不正です");
      return;
    }

    const toEmail = toEmailInput.trim().toLowerCase();
    const fromEmail = fromEmailInput.trim().toLowerCase();
    const recipient = recipients.find((r) => r.email.trim().toLowerCase() === toEmail);
    const my = myEmails.find((m) => m.email.trim().toLowerCase() === fromEmail);

    if (!recipient || !my) {
      alert("テンプレは「保存済みの宛先/送信元」を選んだ状態で登録してください");
      return;
    }

    const payload = {
      content,
      email_list_id: recipient.id,
      my_email_list_id: my.id,
      user_id: debugUserId, // ★ debugUserId
    };

    try {
      setBusy(true);
      const res = await apiFetch(`/templates`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        alert("同じテンプレが既に登録されています");
        return;
      }

      if (!res.ok) {
        const j = await res.json().catch(() => null);
        alert(j?.error || "テンプレの保存に失敗しました");
        return;
      }

      const created: Template | null = await res.json().catch(() => null);
      const tplContent = created?.content ?? content;

      // 保存したらそのまま即適用
      const raw = extractRawFromTemplatedBody(body, activeTemplateContent);
      setBody(applyTemplate(tplContent, raw));
      setActiveTemplateId(created?.id ?? null);
      setActiveTemplateContent(tplContent);

      setTemplateInput(
        `お世話になっております。\n\n${TEMPLATE_MARKER}\n\n何卒よろしくお願いいたします。`
      );
      setOpenTpl(false);
      await fetchTemplates();
      alert("テンプレを保存し、本文に適用しました");
    } catch (e) {
      console.error(e);
      alert("テンプレの保存に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const deleteTemplateById = async (id: number) => {
    try {
      setBusy(true);
      const res = await apiFetch(`/templates/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const j = await res.json().catch(() => null);
        alert(j?.error || "削除に失敗しました");
        return;
      }

      if (activeTemplateId === id) {
        clearTemplate();
      }

      await fetchTemplates();
    } catch (e) {
      console.error(e);
      alert("削除に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  // ----------------------------
  // Deletes: Recipient/MyEmail/Signature
  // ----------------------------

  const deleteRecipientById = async (id: number) => {
    try {
      setBusy(true);
      const res = await apiFetch(`/emails/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const j = await res.json().catch(() => null);
        alert(j?.error || "削除に失敗しました");
        return;
      }
      await refetchAll();
    } catch (e) {
      console.error(e);
      alert("削除に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const deleteMyEmailById = async (id: number) => {
    try {
      setBusy(true);
      const res = await apiFetch(`/my-emails/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const j = await res.json().catch(() => null);
        alert(j?.error || "削除に失敗しました");
        return;
      }
      await refetchAll();
    } catch (e) {
      console.error(e);
      alert("削除に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const deleteSignatureById = async (id: number) => {
    try {
      setBusy(true);
      const res = await apiFetch(`/signatures/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const j = await res.json().catch(() => null);
        alert(j?.error || "削除に失敗しました");
        return;
      }
      await refetchAll();
    } catch (e) {
      console.error(e);
      alert("削除に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  // ----------------------------
  // Send (save history)
  // ----------------------------

  const handleSendAndSave = async () => {
    const toEmail = toEmailInput.trim().toLowerCase();
    const fromEmail = fromEmailInput.trim().toLowerCase();

    if (!isProbablyEmail(toEmail) || !isProbablyEmail(fromEmail)) {
      alert("宛先/送信元のメール形式を確認してください");
      return;
    }

    const recipient = recipients.find((r) => r.email.trim().toLowerCase() === toEmail);
    const my = myEmails.find((m) => m.email.trim().toLowerCase() === fromEmail);

    if (!recipient) {
      alert("宛先が未保存です。先に「保存」を押してください。");
      return;
    }
    if (!my) {
      alert("送信元が未保存です。先に「保存」を押してください。");
      return;
    }
    
    const fullMessage = `${body}\n\n${signatureInput}`;

    const payload = {
      content: `件名：${subject}\n\n${fullMessage}`,
      email_list_id: recipient.id,
      my_email_list_id: my.id,
      user_id: debugUserId, // ★ debugUserId
    };

    try {
      setBusy(true);
      const response = await apiFetch(`/sent`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        alert("送信履歴を記録しました！");
        if (showHistory) await fetchHistory();
      } else {
        const j = await response.json().catch(() => null);
        alert(j?.error || "履歴の保存に失敗しました");
      }
    } catch (error) {
      console.error("送信エラー:", error);
      alert("送信エラーが発生しました");
    } finally {
      setBusy(false);
    }
  };

  // ----------------------------
  // History fetch
  // ----------------------------

  const fetchHistory = async () => {
    setHistoryLoading(true);
    setHistoryError(null);

    try {
      const toEmail = toEmailInput.trim().toLowerCase();
      const fromEmail = fromEmailInput.trim().toLowerCase();

      const recipient = recipients.find(
        (r) => r.email?.trim().toLowerCase() === toEmail
      );
      const my = myEmails.find(
        (m) => m.email?.trim().toLowerCase() === fromEmail
      );

      const params = new URLSearchParams();
      params.set("sort", historySort);
      params.set("limit", String(historyLimit));
      if (historyQuery.trim()) params.set("q", historyQuery.trim());

      if (historyScope === "selected") {
        if (recipient) params.set("email_list_id", String(recipient.id));
        if (my) params.set("my_email_list_id", String(my.id));
      }

      // Query parameterはURLに含める
      const res = await apiFetch(`/sent?${params.toString()}`);
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setHistoryError(j?.error || "履歴の取得に失敗しました");
        setHistory([]);
        return;
      }

      const json = await res.json().catch(() => []);
      setHistory(Array.isArray(json) ? json : []);
    } catch (e) {
      console.error(e);
      setHistoryError("履歴の取得に失敗しました");
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };


  useEffect(() => {
    if (!showHistory) return;
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    showHistory,
    historyScope,
    historySort,
    historyLimit,
    historyQuery,
    toEmailInput,
    fromEmailInput,
    recipients,
    myEmails,
    debugUserId, // ユーザーID変更時も再取得
  ]);

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-10">
        
        {/* ★ デバッグ用: ユーザーID切り替えエリア */}
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-4 shadow-sm">
           <span className="font-bold text-sm text-yellow-800">開発用ユーザー切り替え:</span>
           <div className="flex items-center gap-2">
             <label className="text-sm font-semibold">User ID:</label>
             <input 
               type="number" 
               className="border border-yellow-300 rounded px-2 py-1 w-20 text-center"
               value={debugUserId}
               onChange={(e) => setDebugUserId(Number(e.target.value))}
               min={1}
             />
             <span className="text-xs text-slate-500 ml-2">
             </span>
           </div>
        </div>

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">メール</h1>
          </div>
          <button
            className="text-sm px-4 h-10 rounded-xl border bg-white hover:bg-slate-50"
            type="button"
            onClick={() => setShowHistory((v) => !v)}
          >
            {showHistory ? "履歴を閉じる" : "履歴を見る"}
          </button>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left card */}
          <div className="col-span-12 md:col-span-3">
            <div className="bg-white border rounded-2xl shadow-sm p-6">
              <div className="flex items-center gap-3">
                <img src={avatarUrl} alt="avatar" className="h-12 w-12 rounded-2xl border bg-white" />
                <div className="min-w-0">
                  <div className="text-sm text-slate-500">宛先（教授）</div>
                  <div className="font-bold text-slate-900 truncate">{selectedRecipientName}</div>
                  <div className="text-xs text-slate-500 truncate">{selectedRecipient?.email}</div>
                </div>
              </div>
            </div>

            {/* History */}
            {showHistory && (
              <div className="mt-6 bg-white border rounded-2xl shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900">送信履歴</div>
                  <button
                    type="button"
                    className="text-xs px-3 h-8 rounded-xl border bg-white hover:bg-slate-50"
                    onClick={fetchHistory}
                    disabled={historyLoading}
                  >
                    更新
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="flex gap-2">
                    <select
                      className="h-9 rounded-lg border px-2 bg-white text-sm w-full sm:w-auto min-w-0"
                      value={historyScope}
                      onChange={(e) => setHistoryScope(e.target.value as any)}
                    >
                      <option value="selected">この宛先/送信元</option>
                      <option value="all">全て</option>
                    </select>

                    <select
                      className="h-9 rounded-lg border px-2 bg-white text-sm w-full sm:w-auto min-w-0"
                      value={historySort}
                      onChange={(e) => setHistorySort(e.target.value as any)}
                    >
                      <option value="desc">新しい順</option>
                      <option value="asc">古い順</option>
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <input
                      className="flex-1 h-9 rounded-lg border px-2 bg-white text-sm"
                      placeholder="本文検索（部分一致）"
                      value={historyQuery}
                      onChange={(e) => setHistoryQuery(e.target.value)}
                    />
                    <select
                      className="h-9 rounded-lg border px-2 bg-white text-sm w-full sm:w-auto min-w-0"
                      value={historyLimit}
                      onChange={(e) => setHistoryLimit(Number(e.target.value))}
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </div>

                  {historyError && <div className="text-xs text-red-600">{historyError}</div>}

                  {historyLoading ? (
                    <div className="text-sm text-slate-500">読み込み中…</div>
                  ) : history.length === 0 ? (
                    <div className="text-sm text-slate-500">履歴がありません</div>
                  ) : (
                    <div className="space-y-3">
                      {history.map((m) => (
                        <div key={m.id} className="rounded-xl border bg-slate-50 p-3">
                          <div className="space-y-1">
                            <div className="text-xs text-slate-500">
                              {new Date(m.created_at).toLocaleString()}
                            </div>

                            <div className="text-xs text-slate-600">
                              <div>
                                To:{" "}
                                <span className="font-mono">{m.to_email ?? `#${m.email_list_id}`}</span>
                              </div>
                              <div>
                                From:{" "}
                                <span className="font-mono">
                                  {m.from_email ?? `#${m.my_email_list_id}`}
                                </span>
                              </div>
                            </div>

                            <div className="font-mono whitespace-pre-wrap text-slate-800 text-xs">
                              {m.content}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Main card */}
          <div className="col-span-12 md:col-span-9">
            <div className="bg-white border rounded-2xl shadow-sm">
              <div className="p-8">
                {/* To / From */}
                <div className="grid grid-cols-12 gap-6 items-end">
                  {/* 宛先 */}
                  <div className="col-span-12 md:col-span-6 relative">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Email（宛先）
                    </label>

                    <div className="flex gap-2">
                      <input
                        className="flex-1 h-11 rounded-lg border px-3 bg-white"
                        placeholder="prof@university.ac.jp"
                        value={toEmailInput}
                        onChange={(e) => setToEmailInput(e.target.value)}
                        onFocus={() => {
                          setOpenTo(false);
                          setShowRecipientMeta(false);
                        }}
                      />
                      <button
                        className="h-11 px-4 rounded-xl bg-amber-100 text-slate-800 font-semibold hover:bg-amber-200 transition disabled:opacity-60"
                        onClick={saveRecipient}
                        disabled={busy}
                        type="button"
                      >
                        保存
                      </button>
                      <button
                        className="h-11 w-11 rounded-xl border bg-white hover:bg-slate-50 flex items-center justify-center"
                        onClick={() => setOpenTo((v) => !v)}
                        type="button"
                        aria-label="宛先候補を開く"
                      >
                        {openTo ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    </div>

                    {/* ★新規登録時だけ追加情報 */}
                    {showRecipientMeta && (
                      <div className="mt-4 rounded-2xl border bg-slate-50 p-5">
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-sm">
                            <div className="font-semibold text-slate-800">新しい宛先を登録</div>
                            <div className="text-slate-500 mt-1">
                              Email: <span className="font-mono">{pendingToEmail}</span>
                            </div>
                          </div>
                          <button
                            className="h-9 w-9 rounded-xl border bg-white hover:bg-slate-50 flex items-center justify-center"
                            onClick={() => setShowRecipientMeta(false)}
                            type="button"
                            aria-label="閉じる"
                          >
                            <X size={18} />
                          </button>
                        </div>

                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input
                            className="h-10 rounded-lg border px-3 bg-white text-sm"
                            placeholder="教授名（任意）"
                            value={pendingToName}
                            onChange={(e) => setPendingToName(e.target.value)}
                          />
                          <input
                            className="h-10 rounded-lg border px-3 bg-white text-sm"
                            placeholder="アイコンURL（任意）"
                            value={pendingToAvatar}
                            onChange={(e) => setPendingToAvatar(e.target.value)}
                          />
                        </div>

                        <div className="mt-4">
                          <button
                            className="h-11 px-4 rounded-xl bg-amber-100 text-slate-800 font-semibold hover:bg-amber-200 transition"
                            onClick={confirmSaveRecipient}
                            disabled={busy}
                            type="button"
                          >
                            登録する
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 宛先候補（候補内に削除🗑） */}
                    {openTo && (
                      <div className="absolute z-20 mt-2 w-full rounded-xl border bg-white shadow-lg overflow-hidden">
                        <div className="max-h-56 overflow-auto">
                          {recipients.length === 0 ? (
                            <div className="p-3 text-sm text-slate-500">候補がありません</div>
                          ) : (
                            recipients.map((r) => (
                              <div key={r.id} className="flex items-stretch border-b last:border-b-0">
                                <button
                                  className="flex-1 text-left px-4 py-3 hover:bg-slate-50 text-sm"
                                  onClick={() => {
                                    setToEmailInput(r.email);
                                    setOpenTo(false);
                                    setShowRecipientMeta(false);
                                  }}
                                  type="button"
                                >
                                  <div className="font-semibold text-slate-800">{r.email}</div>
                                  <div className="text-xs text-slate-500">{r.name}</div>
                                </button>
                                <button
                                  className="w-12 flex items-center justify-center hover:bg-red-50 text-red-500"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteRecipientById(r.id);
                                  }}
                                  type="button"
                                  aria-label="宛先を削除"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 送信元 */}
                  <div className="col-span-12 md:col-span-6 relative">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      送信元アドレス
                    </label>

                    <div className="flex gap-2">
                      <input
                        className="flex-1 h-11 rounded-lg border px-3 bg-white"
                        placeholder="me@example.com"
                        value={fromEmailInput}
                        onChange={(e) => setFromEmailInput(e.target.value)}
                        onFocus={() => setOpenFrom(false)}
                      />
                      <button
                        className="h-11 px-4 rounded-xl bg-amber-100 text-slate-800 font-semibold hover:bg-amber-200 transition disabled:opacity-60"
                        onClick={saveMyEmail}
                        disabled={busy}
                        type="button"
                      >
                        保存
                      </button>
                      <button
                        className="h-11 w-11 rounded-xl border bg-white hover:bg-slate-50 flex items-center justify-center"
                        onClick={() => setOpenFrom((v) => !v)}
                        type="button"
                        aria-label="送信元候補を開く"
                      >
                        {openFrom ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    </div>

                    {openFrom && (
                      <div className="absolute z-20 mt-2 w-full rounded-xl border bg-white shadow-lg overflow-hidden">
                        <div className="max-h-56 overflow-auto">
                          {myEmails.length === 0 ? (
                            <div className="p-3 text-sm text-slate-500">候補がありません</div>
                          ) : (
                            myEmails.map((m) => (
                              <div key={m.id} className="flex items-stretch border-b last:border-b-0">
                                <button
                                  className="flex-1 text-left px-4 py-3 hover:bg-slate-50 text-sm"
                                  onClick={() => {
                                    setFromEmailInput(m.email);
                                    setOpenFrom(false);
                                  }}
                                  type="button"
                                >
                                  <div className="font-semibold text-slate-800">{m.email}</div>
                                </button>
                                <button
                                  className="w-12 flex items-center justify-center hover:bg-red-50 text-red-500"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteMyEmailById(m.id);
                                  }}
                                  type="button"
                                  aria-label="送信元を削除"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* content area */}
                <div className="mt-8 rounded-2xl bg-slate-50 p-8">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">件名</label>
                      <input
                        className="w-full h-11 rounded-lg border px-3 bg-white"
                        placeholder="例）【欠席連絡】体調不良のため"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">本文</label>
                      <textarea
                        className="w-full min-h-[220px] rounded-lg border p-4 resize-none bg-white"
                        placeholder="本文を入力してください"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                      />
                    </div>

                    {/* 署名（入力＋保存＋▼、候補内🗑削除） */}
                    <div className="relative">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">署名</label>

                      <textarea
                        className="w-full min-h-[110px] rounded-lg border p-4 resize-none bg-white"
                        placeholder={"例）\n○○大学 ○○学科\n学籍番号：xxxx\n氏名：…"}
                        value={signatureInput}
                        onChange={(e) => setSignatureInput(e.target.value)}
                        onFocus={() => setOpenSig(false)}
                      />

                      <div className="mt-3 flex gap-2">
                        <button
                          className="h-11 px-4 rounded-xl bg-amber-100 text-slate-800 font-semibold hover:bg-amber-200 transition disabled:opacity-60"
                          disabled={busy || !signatureInput.trim()}
                          type="button"
                          onClick={saveSignature}
                        >
                          保存
                        </button>
                        <button
                          className="h-11 w-11 rounded-xl border bg-white hover:bg-slate-50 flex items-center justify-center"
                          onClick={() => setOpenSig((v) => !v)}
                          type="button"
                          aria-label="署名候補を開く"
                        >
                          {openSig ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                      </div>

                      {openSig && (
                        <div className="absolute z-20 mt-2 w-full rounded-xl border bg-white shadow-lg overflow-hidden">
                          <div className="max-h-56 overflow-auto">
                            {signatures.length === 0 ? (
                              <div className="p-3 text-sm text-slate-500">候補がありません</div>
                            ) : (
                              signatures.map((s) => (
                                <div key={s.id} className="flex items-stretch border-b last:border-b-0">
                                  <button
                                    className="flex-1 text-left px-4 py-3 hover:bg-slate-50 text-sm"
                                    onClick={() => {
                                      setSignatureInput(s.content);
                                      setOpenSig(false);
                                    }}
                                    type="button"
                                  >
                                    <div className="text-xs text-slate-500 mb-1">署名 {s.id}</div>
                                    <div className="whitespace-pre-wrap text-slate-800">{s.content}</div>
                                  </button>
                                  <button
                                    className="w-12 flex items-center justify-center hover:bg-red-50 text-red-500"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteSignatureById(s.id);
                                    }}
                                    type="button"
                                    aria-label="署名を削除"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* テンプレ（任意） */}
                    <div className="mt-2">
                      <button
                        className="h-11 px-4 rounded-xl bg-amber-100 text-slate-800 font-semibold hover:bg-amber-200 transition"
                        type="button"
                        onClick={() => setShowTemplateArea((v) => !v)}
                      >
                        {showTemplateArea ? "テンプレを閉じる" : "テンプレを使う"}
                      </button>

                      {showTemplateArea && (
                        <div className="mt-3 rounded-2xl border bg-white p-5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-slate-800">テンプレ</div>
                            <div className="text-xs text-slate-500">
                            </div>
                          </div>

                          <textarea
                            className="mt-3 w-full min-h-[110px] rounded-lg border p-4 resize-none bg-white"
                            value={templateInput}
                            onChange={(e) => setTemplateInput(e.target.value)}
                            onFocus={() => setOpenTpl(false)}
                          />

                          <div className="mt-3 flex gap-2 relative">
                            <button
                              className="h-11 px-4 rounded-xl bg-amber-100 text-slate-800 font-semibold hover:bg-amber-200 transition disabled:opacity-60"
                              disabled={busy || !templateInput.trim()}
                              type="button"
                              onClick={saveTemplate}
                            >
                              保存
                            </button>

                            <button
                              className="h-11 w-11 rounded-xl border bg-white hover:bg-slate-50 flex items-center justify-center"
                              onClick={() => setOpenTpl((v) => !v)}
                              type="button"
                              aria-label="テンプレ候補を開く"
                            >
                              {openTpl ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>

                            {openTpl && (
                              <div className="absolute z-20 mt-12 w-full rounded-xl border bg-white shadow-lg overflow-hidden">
                                <div className="max-h-56 overflow-auto">
                                  {templates.length === 0 ? (
                                    <div className="p-3 text-sm text-slate-500">候補がありません</div>
                                  ) : (
                                    templates.map((t) => (
                                      <div key={t.id} className="flex items-stretch border-b last:border-b-0">
                                        <button
                                          className="flex-1 text-left px-4 py-3 hover:bg-slate-50 text-sm"
                                          onClick={() => handleApplyTemplate(t)}
                                          type="button"
                                        >
                                          <div className="text-xs text-slate-500 mb-1">テンプレ {t.id}</div>
                                          <div className="whitespace-pre-wrap text-slate-800 line-clamp-4">
                                            {t.content}
                                          </div>
                                        </button>
                                        <button
                                          className="w-12 flex items-center justify-center hover:bg-red-50 text-red-500"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            deleteTemplateById(t.id);
                                          }}
                                          type="button"
                                          aria-label="テンプレを削除"
                                        >
                                          <Trash2 size={18} />
                                        </button>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="mt-2 text-xs text-slate-500">
                          {TEMPLATE_MARKER}が本文が入る位置となります
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleSendAndSave}
                      disabled={busy}
                      className="w-full h-12 rounded-xl bg-amber-100 text-slate-800 font-semibold hover:bg-amber-200 transition flex items-center justify-center gap-2 disabled:opacity-60"
                      type="button"
                    >
                      <Send size={18} />
                      Send message
                    </button>

                    <div className="text-xs text-slate-500">
                      ※ 宛先/送信元が未保存の場合は送信できません（先に「保存」を押してください）
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="h-16" />
          </div>
        </div>
      </div>
    </div>
  );
}