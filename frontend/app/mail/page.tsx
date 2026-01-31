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

type SentMail = {
  id: number;
  content: string;
  to_email: string;
  from_email: string;
  created_at: string;
};

const API_BASE = "http://localhost:8080";

const isProbablyEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export default function MailConfirmPage() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [myEmails, setMyEmails] = useState<MyEmail[]>([]);
  const [signatures, setSignatures] = useState<Signature[]>([]);

  const [toEmailInput, setToEmailInput] = useState("");
  const [fromEmailInput, setFromEmailInput] = useState("");
  const [signatureInput, setSignatureInput] = useState("");

  const [subject, setSubject] = useState("");
  const [mailContent, setMailContent] = useState("ここに生成された文章が入ります。適宜手直ししてください。");

  const [openTo, setOpenTo] = useState(false);
  const [openFrom, setOpenFrom] = useState(false);
  const [openSig, setOpenSig] = useState(false);

  const [busy, setBusy] = useState(false);

  const [showRecipientMeta, setShowRecipientMeta] = useState(false);
  const [pendingToEmail, setPendingToEmail] = useState("");
  const [pendingToName, setPendingToName] = useState("");
  const [pendingToAvatar, setPendingToAvatar] = useState("");

  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<SentMail[]>([]);
  const [historyScope, setHistoryScope] = useState<"selected" | "all">("selected");
  const [historySort, setHistorySort] = useState<"desc" | "asc">("desc");
  const [historyLimit, setHistoryLimit] = useState<20 | 50 | 100>(50);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const selectedRecipient = useMemo(() => {
    const email = toEmailInput.trim().toLowerCase();
    return recipients.find((r) => r.email.trim().toLowerCase() === email);
  }, [recipients, toEmailInput]);

  const avatarUrl =
    selectedRecipient?.avatar_url || "https://api.dicebear.com/7.x/pixel-art/svg?seed=default";

  const refetchAll = async () => {
    const [emailsRes, myEmailsRes, sigsRes] = await Promise.all([
      fetch(`${API_BASE}/emails`),
      fetch(`${API_BASE}/my-emails`),
      fetch(`${API_BASE}/signatures`),
    ]);

    if (!emailsRes.ok) throw new Error("宛先一覧の取得に失敗しました");
    if (!myEmailsRes.ok) throw new Error("送信元一覧の取得に失敗しました");
    if (!sigsRes.ok) throw new Error("署名一覧の取得に失敗しました");

    const emailsData: Recipient[] = await emailsRes.json();
    const myEmailsData: MyEmail[] = await myEmailsRes.json();
    const sigsData: Signature[] = await sigsRes.json();

    setRecipients(emailsData);
    setMyEmails(myEmailsData);
    setSignatures(sigsData);

    if (!toEmailInput && emailsData.length > 0) setToEmailInput(emailsData[0].email);
    if (!fromEmailInput && myEmailsData.length > 0) setFromEmailInput(myEmailsData[0].email);
    if (!signatureInput && sigsData.length > 0) setSignatureInput(sigsData[0].content);
  };

  useEffect(() => {
    refetchAll().catch(console.error);
  }, []);

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      setHistoryError(null);

      const params = new URLSearchParams();
      params.set("sort", historySort);
      params.set("limit", String(historyLimit));

      const q = historyQuery.trim();
      if (q) params.set("q", q);

      // 宛先で絞り込み（selected）
      if (historyScope === "selected") {
        // “保存済み宛先” が選ばれてる時だけIDで絞る（未保存なら絞れない）
        const toEmail = toEmailInput.trim().toLowerCase();
        const recipient = recipients.find((r) => r.email.trim().toLowerCase() === toEmail);
        if (recipient) {
          params.set("email_list_id", String(recipient.id));
        } else {
          // 未保存なら空にする（または全件扱いでもOK）
          setHistory([]);
          setHistoryError("宛先が未保存のため履歴を絞り込めません（先に宛先を保存してください）");
          return;
        }
      }

      const res = await fetch(`${API_BASE}/sent?${params.toString()}`);
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || "送信履歴の取得に失敗しました");
      }

      const data: SentMail[] = await res.json();
      setHistory(data);
    } catch (e: any) {
      setHistoryError(e?.message || "送信履歴の取得に失敗しました");
    } finally {
      setHistoryLoading(false);
    }
  };


  const saveRecipient = async () => {
    const email = toEmailInput.trim();
    if (!isProbablyEmail(email)) {
      alert("宛先メールアドレスの形式が正しくありません");
      return;
    }

    const exists = recipients.some((r) => r.email.trim().toLowerCase() === email.toLowerCase());
    if (exists) {
      alert("この宛先は既に登録されています（▼から呼び出せます）");
      return;
    }

    setPendingToEmail(email);
    setPendingToName("");
    setPendingToAvatar("");
    setShowRecipientMeta(true);

    setOpenTo(false);
    setOpenFrom(false);
    setOpenSig(false);
  };

  const confirmSaveRecipient = async () => {
    const email = pendingToEmail.trim();
    if (!isProbablyEmail(email)) {
      alert("宛先メールアドレスの形式が正しくありません");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: pendingToName.trim() || "教授",
          avatar_url: pendingToAvatar.trim(),
        }),
      });

      if (res.status === 409) {
        const j = await res.json().catch(() => null);
        alert(j?.error || "既に登録されています");
        setShowRecipientMeta(false);
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        alert(j?.error || "宛先の保存に失敗しました");
        return;
      }

      setShowRecipientMeta(false);

      await refetchAll();
      setToEmailInput(email);

      alert("宛先を保存しました！");
    } finally {
      setBusy(false);
    }
  };

  const saveMyEmail = async () => {
    const email = fromEmailInput.trim();
    if (!isProbablyEmail(email)) {
      alert("送信元メールアドレスの形式が正しくありません");
      return;
    }

    const exists = myEmails.some((m) => m.email.trim().toLowerCase() === email.toLowerCase());
    if (exists) {
      alert("この送信元は既に登録されています（▼から呼び出せます）");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/my-emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.status === 409) {
        const j = await res.json().catch(() => null);
        alert(j?.error || "既に登録されています");
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        alert(j?.error || "送信元の保存に失敗しました");
        return;
      }

      await refetchAll();
      setFromEmailInput(email);

      alert("送信元を保存しました！");
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
      alert("この署名は既に登録されています（▼から呼び出せます）");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/signatures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (res.status === 409) {
        const j = await res.json().catch(() => null);
        alert(j?.error || "既に登録されています");
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        alert(j?.error || "署名の保存に失敗しました");
        return;
      }

      await refetchAll();
      setSignatureInput(content);

      alert("署名を保存しました！");
    } finally {
      setBusy(false);
    }
  };

  const deleteRecipientById = async (id: number) => {
    if (!confirm("この宛先を削除しますか？")) return;

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/emails/${id}`, { method: "DELETE" });

      if (res.status === 409) {
        const j = await res.json().catch(() => null);
        alert(j?.error || "この宛先は削除できません（履歴で使用中など）");
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        alert(j?.error || "削除に失敗しました");
        return;
      }

      const deleted = recipients.find((r) => r.id === id);
      await refetchAll();
      if (deleted && toEmailInput.trim().toLowerCase() === deleted.email.trim().toLowerCase()) {
        setToEmailInput("");
      }
    } finally {
      setBusy(false);
    }
  };

  const deleteMyEmailById = async (id: number) => {
    if (!confirm("この送信元を削除しますか？")) return;

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/my-emails/${id}`, { method: "DELETE" });

      if (res.status === 409) {
        const j = await res.json().catch(() => null);
        alert(j?.error || "この送信元は削除できません（履歴で使用中など）");
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        alert(j?.error || "削除に失敗しました");
        return;
      }

      const deleted = myEmails.find((m) => m.id === id);
      await refetchAll();
      if (deleted && fromEmailInput.trim().toLowerCase() === deleted.email.trim().toLowerCase()) {
        setFromEmailInput("");
      }
    } finally {
      setBusy(false);
    }
  };

  const deleteSignatureById = async (id: number) => {
    if (!confirm("この署名を削除しますか？")) return;

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/signatures/${id}`, { method: "DELETE" });

      if (res.status === 409) {
        const j = await res.json().catch(() => null);
        alert(j?.error || "この署名は削除できません（履歴で使用中など）");
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        alert(j?.error || "削除に失敗しました");
        return;
      }

      const deleted = signatures.find((s) => s.id === id);
      await refetchAll();
      if (deleted && signatureInput.trim() === deleted.content.trim()) {
        setSignatureInput("");
      }
    } finally {
      setBusy(false);
    }
  };

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

    const fullMessage = `${mailContent}\n\n${signatureInput || ""}`.trim();

    const payload = {
      content: `件名: ${subject}\n\n${fullMessage}`,
      email_list_id: recipient.id,
      my_email_list_id: my.id,
      user_id: 1,
    };

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/sent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => null);
        alert(j?.error || "履歴の保存に失敗しました");
        return;
      }

      alert("送信履歴を記録しました！");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-5xl font-black tracking-tight text-slate-900">メール</h1>

      <div className="mt-8 grid grid-cols-12 gap-10 items-start">
        {/* Avatar side */}
        <div className="col-span-12 md:col-span-3 flex md:block justify-center">
          <div className="flex flex-col items-center">
            <div className="w-28 h-28 rounded-full overflow-hidden shadow-sm border bg-white">
              <img src={avatarUrl} alt="教授のアバター" className="w-full h-full object-cover" />
            </div>
            <div className="mt-3 text-center">
              <div className="font-semibold text-slate-800">{selectedRecipient?.name || "（教授）"}</div>
            </div>
          </div>
        </div>

        {/* Main card */}
        <div className="col-span-12 md:col-span-9">
          <div className="bg-white border rounded-2xl shadow-sm">
            <div className="p-8">
              {/* To / From */}
              <div className="grid grid-cols-12 gap-6 items-end">
                {/* 宛先 */}
                <div className="col-span-12 md:col-span-6 relative">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Email（宛先）</label>

                  <div className="flex gap-2">
                    <input
                      className="flex-1 h-11 rounded-lg border px-3 bg-white"
                      placeholder="prof@university.ac.jp"
                      value={toEmailInput}
                      onChange={(e) => setToEmailInput(e.target.value)}
                      onFocus={() => setOpenTo(false)}
                    />
                    <button
                      className="
                        h-11 px-4 rounded-xl
                        bg-amber-100 text-slate-800
                        font-semibold
                        hover:bg-amber-200
                        transition
                        disabled:opacity-60
                      " 
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
                          className="h-11 px-4 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
                          onClick={confirmSaveRecipient}
                          disabled={busy}
                          type="button"
                        >
                          登録する
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 宛先候補（アイデアA：候補内に削除🗑） */}
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
                  <label className="block text-sm font-semibold text-slate-700 mb-2">送信元アドレス</label>

                  <div className="flex gap-2">
                    <input
                      className="flex-1 h-11 rounded-lg border px-3 bg-white"
                      placeholder="me@example.com"
                      value={fromEmailInput}
                      onChange={(e) => setFromEmailInput(e.target.value)}
                      onFocus={() => setOpenFrom(false)}
                    />
                    <button
                      className="
                        h-11 px-4 rounded-xl
                        bg-amber-100 text-slate-800
                        font-semibold
                        hover:bg-amber-200
                        transition
                        disabled:opacity-60
                      "
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
                      value={mailContent}
                      onChange={(e) => setMailContent(e.target.value)}
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
                        className="
                          h-11 px-4 rounded-xl
                          bg-amber-100 text-slate-800
                          font-semibold
                          hover:bg-amber-200
                          transition
                          disabled:opacity-60
                        "
                        onClick={saveSignature}
                        disabled={busy}
                        type="button"
                      >
                        保存
                      </button>
                      <button
                        className="h-11 w-11 rounded-xl border bg-white hover:bg-slate-50 flex items-center justify-center"
                        onClick={() => setOpenSig((v) => !v)}
                        type="button"
                        aria-label="署名候補を開閉"
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

                {/* ===== 送信履歴 ===== */}
                  <div className="mt-10 border-t pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-700">送信履歴</div>
                        <div className="text-xs text-slate-500">
                          宛先で絞り込み / ソート / 検索できます
                        </div>
                      </div>

                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:underline"
                        onClick={async () => {
                          const next = !showHistory;
                          setShowHistory(next);
                          if (next) await fetchHistory();
                        }}
                      >
                        {showHistory ? "閉じる" : "表示"}
                      </button>
                    </div>

                    {showHistory && (
                      <div className="mt-4 space-y-3">
                        {/* Controls */}
                        <div className="flex flex-wrap gap-2 items-center">
                          <select
                            className="h-10 rounded-lg border px-3 bg-white text-sm"
                            value={historyScope}
                            onChange={(e) => setHistoryScope(e.target.value as any)}
                          >
                            <option value="selected">この宛先だけ</option>
                            <option value="all">全件</option>
                          </select>

                          <select
                            className="h-10 rounded-lg border px-3 bg-white text-sm"
                            value={historySort}
                            onChange={(e) => setHistorySort(e.target.value as any)}
                          >
                            <option value="desc">新しい順</option>
                            <option value="asc">古い順</option>
                          </select>

                          <select
                            className="h-10 rounded-lg border px-3 bg-white text-sm"
                            value={historyLimit}
                            onChange={(e) => setHistoryLimit(Number(e.target.value) as any)}
                          >
                            <option value={20}>20件</option>
                            <option value={50}>50件</option>
                            <option value={100}>100件</option>
                          </select>

                          <input
                            className="h-10 flex-1 min-w-[220px] rounded-lg border px-3 bg-white text-sm"
                            placeholder="本文検索（例：欠席 / 体調 / 課題）"
                            value={historyQuery}
                            onChange={(e) => setHistoryQuery(e.target.value)}
                          />

                          <button
                            type="button"
                            className="h-10 px-4 rounded-xl bg-amber-100 text-slate-800 font-semibold hover:bg-amber-200 transition disabled:opacity-60"
                            onClick={fetchHistory}
                            disabled={historyLoading}
                          >
                            更新
                          </button>
                        </div>

                        {historyError && (
                          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                            {historyError}
                          </div>
                        )}

                        {historyLoading ? (
                          <div className="text-xs text-slate-500">読み込み中...</div>
                        ) : history.length === 0 ? (
                          <div className="text-xs text-slate-500">履歴がありません</div>
                        ) : (
                          <div className="space-y-2">
                            {history.map((m) => (
                              <div key={m.id} className="rounded-lg border bg-slate-50 p-3 text-xs">
                                <div className="space-y-1">
                                  <div className="text-xs text-slate-500">
                                    {new Date(m.created_at).toLocaleString()}
                                  </div>

                                  <div className="text-xs text-slate-600">
                                    <div>
                                      To: <span className="font-mono">{m.to_email}</span>
                                    </div>
                                    <div>
                                      From: <span className="font-mono">{m.from_email}</span>
                                    </div>
                                  </div>

                                  <div className="font-mono whitespace-pre-wrap text-slate-800">
                                    {m.content}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

              </div>
            </div>
          </div>

          <div className="h-16" />
        </div>
      </div>
    </div>
  );
}
