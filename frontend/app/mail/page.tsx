"use client";

import { useEffect, useMemo, useState } from "react";
import { Send, ChevronDown, ChevronUp, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

import * as PopoverPrimitive from "@radix-ui/react-popover";

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

const devUserID = 1;
const API_BASE = "http://localhost:8080";
const TEMPLATE_MARKER = "{{BODY}}";

const amberBtn =
  "bg-[#FFF1C9] text-slate-900 hover:bg-[#ffe7a3] active:bg-[#ffde88] disabled:opacity-60 disabled:pointer-events-none";

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
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [myEmails, setMyEmails] = useState<MyEmail[]>([]);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [busy, setBusy] = useState(false);

  const [toEmailInput, setToEmailInput] = useState("");
  const [fromEmailInput, setFromEmailInput] = useState("");
  const [signatureInput, setSignatureInput] = useState("");

  const [body, setBody] = useState("ここに生成された文章が入ります。適宜手直ししてください。");
  const [subject, setSubject] = useState("");

  const [openTo, setOpenTo] = useState(false);
  const [openFrom, setOpenFrom] = useState(false);
  const [openSig, setOpenSig] = useState(false);

  const [showRecipientMeta, setShowRecipientMeta] = useState(false);
  const [pendingToEmail, setPendingToEmail] = useState("");
  const [pendingToName, setPendingToName] = useState("");
  const [pendingToAvatar, setPendingToAvatar] = useState("");

  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<SentMail[]>([]);
  const [historyScope, setHistoryScope] = useState<"selected" | "all">("selected");
  const [historySort, setHistorySort] = useState<"desc" | "asc">("desc");
  const [historyLimit, setHistoryLimit] = useState(50);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [showTemplateArea, setShowTemplateArea] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateInput, setTemplateInput] = useState(
    `お世話になっております。\n\n${TEMPLATE_MARKER}\n\n何卒よろしくお願いいたします。`
  );
  const [openTpl, setOpenTpl] = useState(false);

  const [activeTemplateId, setActiveTemplateId] = useState<number | null>(null);
  const [activeTemplateContent, setActiveTemplateContent] = useState<string | null>(null);

  const selectedRecipient = useMemo(() => {
    const email = toEmailInput.trim().toLowerCase();
    return recipients.find((r) => r.email?.trim().toLowerCase() === email);
  }, [recipients, toEmailInput]);

  const avatarUrl =
    selectedRecipient?.avatar_url || "https://api.dicebear.com/7.x/pixel-art/svg?seed=Teacher";
  const selectedRecipientName = selectedRecipient?.name?.trim() || "（未保存の宛先）";

  const refetchAll = async () => {
    const [emailsRes, myEmailsRes, sigsRes] = await Promise.all([
      fetch(`${API_BASE}/emails`),
      fetch(`${API_BASE}/my-emails`),
      fetch(`${API_BASE}/signatures`),
    ]);

    const emailsData = (await emailsRes.json()) as Recipient[];
    const myEmailsData = (await myEmailsRes.json()) as MyEmail[];
    const sigsData = (await sigsRes.json()) as Signature[];

    setRecipients(Array.isArray(emailsData) ? emailsData : []);
    setMyEmails(Array.isArray(myEmailsData) ? myEmailsData : []);
    setSignatures(Array.isArray(sigsData) ? sigsData : []);

    if (!toEmailInput && Array.isArray(emailsData) && emailsData.length > 0) setToEmailInput(emailsData[0].email);
    if (!fromEmailInput && Array.isArray(myEmailsData) && myEmailsData.length > 0) setFromEmailInput(myEmailsData[0].email);
    if (!signatureInput && Array.isArray(sigsData) && sigsData.length > 0) setSignatureInput(sigsData[0].content);
  };

  useEffect(() => {
    refetchAll().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveRecipient = async () => {
    const email = toEmailInput.trim();
    if (!isProbablyEmail(email)) return alert("宛先のメール形式を確認してください");

    const exists = recipients.some((r) => r.email?.trim().toLowerCase() === email.toLowerCase());
    if (exists) return alert("この宛先は既に登録されています");

    setPendingToEmail(email);
    setPendingToName("");
    setPendingToAvatar("");
    setShowRecipientMeta(true);
    setOpenTo(false);
  };

  const confirmSaveRecipient = async () => {
    const email = pendingToEmail.trim();
    if (!isProbablyEmail(email)) return alert("宛先のメール形式を確認してください");

    const exists = recipients.some((r) => r.email?.trim().toLowerCase() === email.toLowerCase());
    if (exists) {
      setShowRecipientMeta(false);
      return alert("この宛先は既に登録されています");
    }

    const payload = {
      user_id: devUserID,
      email,
      name: pendingToName.trim(),
      avatar_url: pendingToAvatar.trim(),
    };

    try {
      setBusy(true);
      const res = await fetch(`${API_BASE}/emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => null);
        return alert(j?.error || "宛先の保存に失敗しました");
      }

      setShowRecipientMeta(false);
      setToEmailInput(email);
      await refetchAll();
    } catch {
      alert("宛先の保存に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const saveMyEmail = async () => {
    const email = fromEmailInput.trim();
    if (!isProbablyEmail(email)) return alert("送信元のメール形式を確認してください");

    const exists = myEmails.some((m) => m.email?.trim().toLowerCase() === email.toLowerCase());
    if (exists) return alert("この送信元は既に登録されています");

    const payload = { user_id: devUserID, email };

    try {
      setBusy(true);
      const res = await fetch(`${API_BASE}/my-emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) return alert("この送信元は既に登録されています");

      if (!res.ok) {
        const j = await res.json().catch(() => null);
        return alert(j?.error || "送信元の保存に失敗しました");
      }

      await refetchAll();
    } catch {
      alert("送信元の保存に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const saveSignature = async () => {
    const content = signatureInput.trim();
    if (!content) return alert("署名が空です");

    const exists = signatures.some((s) => s.content?.trim() === content);
    if (exists) return alert("同じ署名が既に登録されています");

    const payload = { user_id: devUserID, content };

    try {
      setBusy(true);
      const res = await fetch(`${API_BASE}/signatures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) return alert("同じ署名が既に登録されています");

      if (!res.ok) {
        const j = await res.json().catch(() => null);
        return alert(j?.error || "署名の保存に失敗しました");
      }

      await refetchAll();
    } catch {
      alert("署名の保存に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const fetchTemplates = async () => {
    const toEmail = toEmailInput.trim().toLowerCase();
    const fromEmail = fromEmailInput.trim().toLowerCase();
    const recipient = recipients.find((r) => r.email?.trim().toLowerCase() === toEmail);
    const my = myEmails.find((m) => m.email?.trim().toLowerCase() === fromEmail);

    if (!recipient || !my) {
      setTemplates([]);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/templates?email_list_id=${recipient.id}&my_email_list_id=${my.id}`);
      if (!res.ok) return;
      const data = await res.json().catch(() => []);
      setTemplates(Array.isArray(data) ? data : []);
    } catch {
      setTemplates([]);
    }
  };

  useEffect(() => {
    if (!showTemplateArea) return;
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTemplateArea, toEmailInput, fromEmailInput, recipients, myEmails]);

  const handleApplyTemplate = (tpl: Template) => {
    const raw = extractRawFromTemplatedBody(body, activeTemplateContent);
    try {
      validateTemplateOrThrow(tpl.content);
    } catch (e: any) {
      return alert(e.message || "テンプレが不正です");
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
      return alert(e.message || "テンプレが不正です");
    }

    const toEmail = toEmailInput.trim().toLowerCase();
    const fromEmail = fromEmailInput.trim().toLowerCase();
    const recipient = recipients.find((r) => r.email?.trim().toLowerCase() === toEmail);
    const my = myEmails.find((m) => m.email?.trim().toLowerCase() === fromEmail);

    if (!recipient || !my) return alert("テンプレは「保存済みの宛先/送信元」を選んだ状態で登録してください");

    const payload = {
      content,
      email_list_id: recipient.id,
      my_email_list_id: my.id,
      user_id: devUserID,
    };

    try {
      setBusy(true);
      const res = await fetch(`${API_BASE}/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) return alert("同じテンプレが既に登録されています");

      if (!res.ok) {
        const j = await res.json().catch(() => null);
        return alert(j?.error || "テンプレの保存に失敗しました");
      }

      const created: Template | null = await res.json().catch(() => null);
      const tplContent = created?.content ?? content;

      const raw = extractRawFromTemplatedBody(body, activeTemplateContent);
      setBody(applyTemplate(tplContent, raw));
      setActiveTemplateId(created?.id ?? null);
      setActiveTemplateContent(tplContent);

      setTemplateInput(`お世話になっております。\n\n${TEMPLATE_MARKER}\n\n何卒よろしくお願いいたします。`);
      setOpenTpl(false);
      await fetchTemplates();
      alert("テンプレを保存し、本文に適用しました");
    } catch {
      alert("テンプレの保存に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const deleteTemplateById = async (id: number) => {
    try {
      setBusy(true);
      const res = await fetch(`${API_BASE}/templates/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const j = await res.json().catch(() => null);
        return alert(j?.error || "削除に失敗しました");
      }
      if (activeTemplateId === id) clearTemplate();
      await fetchTemplates();
    } catch {
      alert("削除に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const deleteRecipientById = async (id: number) => {
    try {
      setBusy(true);
      const res = await fetch(`${API_BASE}/emails/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const j = await res.json().catch(() => null);
        return alert(j?.error || "削除に失敗しました");
      }
      await refetchAll();
    } catch {
      alert("削除に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const deleteMyEmailById = async (id: number) => {
    try {
      setBusy(true);
      const res = await fetch(`${API_BASE}/my-emails/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const j = await res.json().catch(() => null);
        return alert(j?.error || "削除に失敗しました");
      }
      await refetchAll();
    } catch {
      alert("削除に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const deleteSignatureById = async (id: number) => {
    try {
      setBusy(true);
      const res = await fetch(`${API_BASE}/signatures/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const j = await res.json().catch(() => null);
        return alert(j?.error || "削除に失敗しました");
      }
      await refetchAll();
    } catch {
      alert("削除に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const handleSendAndSave = async () => {
    const toEmail = toEmailInput.trim().toLowerCase();
    const fromEmail = fromEmailInput.trim().toLowerCase();

    if (!isProbablyEmail(toEmail) || !isProbablyEmail(fromEmail)) return alert("宛先/送信元のメール形式を確認してください");

    const recipient = recipients.find((r) => r.email?.trim().toLowerCase() === toEmail);
    const my = myEmails.find((m) => m.email?.trim().toLowerCase() === fromEmail);

    if (!recipient) return alert("宛先が未保存です。先に「保存」を押してください。");
    if (!my) return alert("送信元が未保存です。先に「保存」を押してください。");
    if (!signatureInput.trim()) return alert("署名が空です。入力してください。");

    const fullMessage = `${body}\n\n${signatureInput}`;

    const payload = {
      content: `件名：${subject}\n\n${fullMessage}`,
      email_list_id: recipient.id,
      my_email_list_id: my.id,
      user_id: devUserID,
    };

    try {
      setBusy(true);
      const response = await fetch(`${API_BASE}/sent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        alert("送信履歴を記録しました！");
        if (showHistory) await fetchHistory();
      } else {
        const j = await response.json().catch(() => null);
        alert(j?.error || "履歴の保存に失敗しました");
      }
    } catch {
      alert("送信エラーが発生しました");
    } finally {
      setBusy(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    setHistoryError(null);

    try {
      const toEmail = toEmailInput.trim().toLowerCase();
      const fromEmail = fromEmailInput.trim().toLowerCase();

      const recipient = recipients.find((r) => r.email?.trim().toLowerCase() === toEmail);
      const my = myEmails.find((m) => m.email?.trim().toLowerCase() === fromEmail);

      const params = new URLSearchParams();
      params.set("sort", historySort);
      params.set("limit", String(historyLimit));
      if (historyQuery.trim()) params.set("q", historyQuery.trim());

      if (historyScope === "selected") {
        if (recipient) params.set("email_list_id", String(recipient.id));
        if (my) params.set("my_email_list_id", String(my.id));
      }

      const res = await fetch(`${API_BASE}/sent?${params.toString()}`);
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setHistoryError(j?.error || "履歴の取得に失敗しました");
        setHistory([]);
        return;
      }

      const json = await res.json().catch(() => []);
      setHistory(Array.isArray(json) ? json : []);
    } catch {
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
  ]);

  const safeHistory = Array.isArray(history) ? history : [];

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">ご教授ください</h1>
          <Button variant="outline" className="rounded-xl" type="button" onClick={() => setShowHistory((v) => !v)}>
            {showHistory ? "履歴を閉じる" : "履歴を見る"}
          </Button>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-3 space-y-6">
            <Card className="rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <img src={avatarUrl} alt="avatar" className="h-12 w-12 rounded-2xl border bg-white" />
                  <div className="min-w-0">
                    <div className="text-sm text-slate-500">宛先（教授）</div>
                    <div className="font-bold text-slate-900 truncate">{selectedRecipientName}</div>
                    <div className="text-xs text-slate-500 truncate">{selectedRecipient?.email}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {showHistory && (
              <Card className="rounded-2xl">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">送信履歴</CardTitle>
                    <Button variant="outline" className="h-8 rounded-xl text-xs px-3" type="button" onClick={fetchHistory} disabled={historyLoading}>
                      更新
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="pt-0 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Select value={historyScope} onValueChange={(v) => setHistoryScope(v as any)}>
                      <SelectTrigger className="h-9 rounded-lg w-full sm:w-auto">
                        <SelectValue placeholder="範囲" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="selected">この宛先/送信元</SelectItem>
                        <SelectItem value="all">全て</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={historySort} onValueChange={(v) => setHistorySort(v as any)}>
                      <SelectTrigger className="h-9 rounded-lg w-full sm:w-auto">
                        <SelectValue placeholder="並び" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="desc">新しい順</SelectItem>
                        <SelectItem value="asc">古い順</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Input
                      className="h-9 rounded-lg w-full min-w-0"
                      placeholder="本文検索（部分一致）"
                      value={historyQuery}
                      onChange={(e) => setHistoryQuery(e.target.value)}
                    />

                    <Select value={String(historyLimit)} onValueChange={(v) => setHistoryLimit(Number(v))}>
                      <SelectTrigger className="h-9 rounded-lg w-full sm:w-auto">
                        <SelectValue placeholder="件数" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {historyError && <div className="text-xs text-red-600">{historyError}</div>}

                  {historyLoading ? (
                    <div className="text-sm text-slate-500">読み込み中…</div>
                  ) : safeHistory.length === 0 ? (
                    <div className="text-sm text-slate-500">履歴がありません</div>
                  ) : (
                    <div className="space-y-3">
                      {safeHistory.map((m) => (
                        <div key={m.id} className="rounded-xl border bg-slate-50 p-3">
                          <div className="space-y-1">
                            <div className="text-xs text-slate-500">{new Date(m.created_at).toLocaleString()}</div>
                            <div className="text-xs text-slate-600">
                              <div>
                                To: <span className="font-mono">{m.to_email ?? `#${m.email_list_id}`}</span>
                              </div>
                              <div>
                                From: <span className="font-mono">{m.from_email ?? `#${m.my_email_list_id}`}</span>
                              </div>
                            </div>
                            <div className="font-mono whitespace-pre-wrap text-slate-800 text-xs">{m.content}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="col-span-12 md:col-span-9">
            <Card className="rounded-2xl">
              <CardContent className="p-8">
                <div className="grid grid-cols-12 gap-6 items-end">
                  <div className="col-span-12 md:col-span-6">
                    <Label className="text-sm font-semibold text-slate-700">Email（宛先）</Label>

                    <div className="mt-2 flex gap-2">
                      <Input
                        className="h-11 rounded-lg"
                        placeholder="prof@university.ac.jp"
                        value={toEmailInput}
                        onChange={(e) => setToEmailInput(e.target.value)}
                        onFocus={() => {
                          setOpenTo(false);
                          setShowRecipientMeta(false);
                        }}
                      />

                      <Button className={`h-11 rounded-xl px-4 ${amberBtn}`} type="button" onClick={saveRecipient} disabled={busy}>
                        保存
                      </Button>

                      <Popover open={openTo} onOpenChange={setOpenTo}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="h-11 w-11 rounded-xl px-0"
                            type="button"
                            aria-label="宛先候補を開く"
                          >
                            {openTo ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </Button>
                        </PopoverTrigger>

                        <PopoverPrimitive.Portal>
                          <PopoverContent className="z-50 p-0 rounded-xl w-72 max-w-[calc(100vw-24px)]" align="end" sideOffset={8} collisionPadding={12}>
                            <ScrollArea className="max-h-56">
                              {recipients.length === 0 ? (
                                <div className="p-3 text-sm text-slate-500">候補がありません</div>
                              ) : (
                                recipients.map((r, idx) => (
                                  <div key={r.id}>
                                    <div className="flex items-stretch">
                                      <Button
                                        variant="ghost"
                                        className="flex-1 h-auto justify-start rounded-none px-4 py-3 text-left"
                                        type="button"
                                        onClick={() => {
                                          setToEmailInput(r.email);
                                          setOpenTo(false);
                                          setShowRecipientMeta(false);
                                        }}
                                      >
                                        <div className="w-full">
                                          <div className="font-semibold text-slate-900">{r.email}</div>
                                          <div className="text-xs text-slate-500">{r.name}</div>
                                        </div>
                                      </Button>

                                      <Button
                                        variant="ghost"
                                        className="w-12 rounded-none text-red-500 hover:bg-red-50"
                                        type="button"
                                        aria-label="宛先を削除"
                                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                                          e.stopPropagation();
                                          deleteRecipientById(r.id);
                                        }}
                                      >
                                        <Trash2 size={18} />
                                      </Button>
                                    </div>

                                    {idx !== recipients.length - 1 && <Separator />}
                                  </div>
                                ))
                              )}
                            </ScrollArea>
                          </PopoverContent>
                        </PopoverPrimitive.Portal>
                      </Popover>
                    </div>

                    {showRecipientMeta && (
                      <Card className="mt-4 rounded-2xl bg-slate-50">
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">新しい宛先を登録</div>
                              <div className="text-sm text-slate-500 mt-1">
                                Email: <span className="font-mono">{pendingToEmail}</span>
                              </div>
                            </div>
                            <Button variant="outline" className="h-9 w-9 rounded-xl p-0" type="button" onClick={() => setShowRecipientMeta(false)} aria-label="閉じる">
                              <X size={18} />
                            </Button>
                          </div>

                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input className="h-10 rounded-lg" placeholder="教授名（任意）" value={pendingToName} onChange={(e) => setPendingToName(e.target.value)} />
                            <Input className="h-10 rounded-lg" placeholder="アイコンURL（任意）" value={pendingToAvatar} onChange={(e) => setPendingToAvatar(e.target.value)} />
                          </div>

                          <div className="mt-4">
                            <Button className="h-11 rounded-xl bg-blue-600 text-white hover:bg-blue-700" type="button" onClick={confirmSaveRecipient} disabled={busy}>
                              登録する
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  <div className="col-span-12 md:col-span-6">
                    <Label className="text-sm font-semibold text-slate-700">送信元アドレス</Label>

                    <div className="mt-2 flex gap-2">
                      <Input
                        className="h-11 rounded-lg"
                        placeholder="me@example.com"
                        value={fromEmailInput}
                        onChange={(e) => setFromEmailInput(e.target.value)}
                        onFocus={() => setOpenFrom(false)}
                      />

                      <Button className={`h-11 rounded-xl px-4 ${amberBtn}`} type="button" onClick={saveMyEmail} disabled={busy}>
                        保存
                      </Button>

                      <Popover open={openFrom} onOpenChange={setOpenFrom}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="h-11 w-11 rounded-xl px-0" type="button" aria-label="送信元候補を開く">
                            {openFrom ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="z-50 p-0 rounded-xl w-72 max-w-[calc(100vw-24px)]" align="end" sideOffset={8} collisionPadding={12}>
                          <ScrollArea className="max-h-56">
                            {myEmails.length === 0 ? (
                              <div className="p-3 text-sm text-slate-500">候補がありません</div>
                            ) : (
                              myEmails.map((m, idx) => (
                                <div key={m.id}>
                                  <div className="flex items-stretch">
                                    <Button
                                      variant="ghost"
                                      className="flex-1 h-auto justify-start rounded-none px-4 py-3 text-left"
                                      type="button"
                                      onClick={() => {
                                        setFromEmailInput(m.email);
                                        setOpenFrom(false);
                                      }}
                                    >
                                      <div className="w-full">
                                        <div className="font-semibold text-slate-900">{m.email}</div>
                                      </div>
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      className="w-12 rounded-none text-red-500 hover:bg-red-50"
                                      type="button"
                                      aria-label="送信元を削除"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteMyEmailById(m.id);
                                      }}
                                    >
                                      <Trash2 size={18} />
                                    </Button>
                                  </div>
                                  {idx !== myEmails.length - 1 && <Separator />}
                                </div>
                              ))
                            )}
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>

                <div className="mt-8 rounded-2xl bg-slate-50 p-8">
                  <div className="space-y-6">
                    <div>
                      <Label className="text-sm font-semibold text-slate-700">件名</Label>
                      <Input
                        className="mt-2 h-11 rounded-lg bg-white"
                        placeholder="例）【欠席連絡】体調不良のため"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                      />
                    </div>

                    <div>
                      <Label className="text-sm font-semibold text-slate-700">本文</Label>
                      <Textarea
                        className="mt-2 min-h-[220px] rounded-lg bg-white"
                        placeholder="本文を入力してください"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                      />

                      {activeTemplateContent && (
                        <Card className="mt-3 rounded-xl">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-semibold text-slate-900">テンプレ適用中（ID: {activeTemplateId ?? "—"}）</div>
                              <Button variant="outline" className="h-9 rounded-xl text-sm px-3" type="button" onClick={clearTemplate}>
                                <X size={16} />
                                <span className="ml-2">解除</span>
                              </Button>
                            </div>
                            <div className="mt-2 text-xs text-slate-500">※ テンプレ切替時は、可能なら前テンプレの「本文部分」だけを抜いて差し替えます。</div>
                          </CardContent>
                        </Card>
                      )}
                    </div>

                    <div>
                      <Label className="text-sm font-semibold text-slate-700">署名</Label>

                      <Textarea
                        className="mt-2 min-h-[110px] rounded-lg bg-white"
                        placeholder={"例）\n○○大学 ○○学科\n学籍番号：xxxx\n氏名：…"}
                        value={signatureInput}
                        onChange={(e) => setSignatureInput(e.target.value)}
                        onFocus={() => setOpenSig(false)}
                      />

                      <div className="mt-3 flex gap-2">
                        <Button className={`h-11 rounded-xl px-4 ${amberBtn}`} disabled={busy || !signatureInput.trim()} type="button" onClick={saveSignature}>
                          保存
                        </Button>

                        <Popover open={openSig} onOpenChange={setOpenSig}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="h-11 w-11 rounded-xl px-0" type="button" aria-label="署名候補を開く">
                              {openSig ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="z-50 p-0 rounded-xl w-72 max-w-[calc(100vw-24px)]" align="end" sideOffset={8} collisionPadding={12}>
                            <ScrollArea className="max-h-56">
                              {signatures.length === 0 ? (
                                <div className="p-3 text-sm text-slate-500">候補がありません</div>
                              ) : (
                                signatures.map((s, idx) => (
                                  <div key={s.id}>
                                    <div className="flex items-stretch">
                                      <Button
                                        variant="ghost"
                                        className="flex-1 h-auto justify-start rounded-none px-4 py-3 text-left"
                                        type="button"
                                        onClick={() => {
                                          setSignatureInput(s.content);
                                          setOpenSig(false);
                                        }}
                                      >
                                        <div className="w-full">
                                          <div className="text-xs text-slate-500 mb-1">署名 {s.id}</div>
                                          <div className="whitespace-pre-wrap text-slate-900">{s.content}</div>
                                        </div>
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        className="w-12 rounded-none text-red-500 hover:bg-red-50"
                                        type="button"
                                        aria-label="署名を削除"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          deleteSignatureById(s.id);
                                        }}
                                      >
                                        <Trash2 size={18} />
                                      </Button>
                                    </div>
                                    {idx !== signatures.length - 1 && <Separator />}
                                  </div>
                                ))
                              )}
                            </ScrollArea>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    <div>
                      <Button className={`h-11 rounded-xl px-4 ${amberBtn}`} type="button" onClick={() => setShowTemplateArea((v) => !v)}>
                        {showTemplateArea ? "テンプレを閉じる" : "テンプレを使う"}
                      </Button>

                      {showTemplateArea && (
                        <Card className="mt-3 rounded-2xl">
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between gap-3">
                              <CardTitle className="text-base">テンプレ（宛先ごと）</CardTitle>
                              <div className="text-xs text-slate-500">※ 候補クリックで本文へ反映 / 保存したら即適用</div>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <Textarea
                              className="min-h-[110px] rounded-lg bg-white"
                              value={templateInput}
                              onChange={(e) => setTemplateInput(e.target.value)}
                              onFocus={() => setOpenTpl(false)}
                            />

                            <div className="mt-3 flex gap-2 relative">
                              <Button className={`h-11 rounded-xl px-4 ${amberBtn}`} disabled={busy || !templateInput.trim()} type="button" onClick={saveTemplate}>
                                保存
                              </Button>

                              <Popover open={openTpl} onOpenChange={setOpenTpl}>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" className="h-11 w-11 rounded-xl px-0" type="button" aria-label="テンプレ候補を開く">
                                    {openTpl ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="z-50 p-0 rounded-xl w-72 max-w-[calc(100vw-24px)]" align="end" sideOffset={8} collisionPadding={12}>
                                  <ScrollArea className="max-h-56">
                                    {templates.length === 0 ? (
                                      <div className="p-3 text-sm text-slate-500">候補がありません</div>
                                    ) : (
                                      templates.map((t, idx) => (
                                        <div key={t.id}>
                                          <div className="flex items-stretch">
                                            <Button variant="ghost" className="flex-1 h-auto justify-start rounded-none px-4 py-3 text-left" type="button" onClick={() => handleApplyTemplate(t)}>
                                              <div className="w-full">
                                                <div className="text-xs text-slate-500 mb-1">テンプレ {t.id}</div>
                                                <div className="whitespace-pre-wrap text-slate-900 line-clamp-4">{t.content}</div>
                                              </div>
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              className="w-12 rounded-none text-red-500 hover:bg-red-50"
                                              type="button"
                                              aria-label="テンプレを削除"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                deleteTemplateById(t.id);
                                              }}
                                            >
                                              <Trash2 size={18} />
                                            </Button>
                                          </div>
                                          {idx !== templates.length - 1 && <Separator />}
                                        </div>
                                      ))
                                    )}
                                  </ScrollArea>
                                </PopoverContent>
                              </Popover>
                            </div>

                            <div className="mt-2 text-xs text-slate-500">
                              ルール：テンプレ内に {TEMPLATE_MARKER} を<strong>1つだけ</strong>入れてください（保存時に検証します）。
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>

                    <Button
                      className={`w-full h-12 rounded-xl font-semibold flex items-center justify-center gap-2 ${amberBtn}`}
                      type="button"
                      onClick={handleSendAndSave}
                      disabled={busy}
                    >
                      <Send size={18} />
                      Send message
                    </Button>

                    <div className="text-xs text-slate-500">
                      ※ 宛先/送信元が未保存の場合は送信できません（先に「保存」を押してください）
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="h-16" />
          </div>
        </div>
      </div>
    </div>
  );
}
