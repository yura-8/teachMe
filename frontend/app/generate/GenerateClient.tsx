"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";

type GenerateResponse = {
  [key: string]: unknown;
};

type User = {
  id: number;
  email: string;
  name?: string;
  avatar_url?: string;
};

type MyEmailList = {
  id: number;
  user_id: number;
  email: string;
};

type EmailList = {
  id: number;
  user_id: number;
  email: string;
  name?: string;
};

export default function GenerateClient() {
  const [prompt, setPrompt] = useState("");
  const [useGemini, setUseGemini] = useState(false);
  const [level, setLevel] = useState(3);

  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState<string>("");

  const [myEmailLists, setMyEmailLists] = useState<MyEmailList[]>([]);
  const [myEmailListId, setMyEmailListId] = useState<string>("");

  const [emailLists, setEmailLists] = useState<EmailList[]>([]);
  const [emailListId, setEmailListId] = useState<string>("");

  const [sentJson, setSentJson] = useState<string | null>(null);
  const [resultJson, setResultJson] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedUser = users.find((u) => String(u.id) === userId) ?? null;
  const avatarSrc =
    selectedUser?.avatar_url && selectedUser.avatar_url.trim() !== ""
      ? selectedUser.avatar_url
      : "/business_man_angry.png";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/users");
        const data = (await res.json()) as User[];
        if (!res.ok) return;
        if (cancelled) return;
        setUsers(data);
        // Default: no user selected (allows null IDs end-to-end).
        setUserId("");
      } catch {
        // ignore; user can still type prompt and see errors on submit
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setMyEmailLists([]);
      setMyEmailListId("");
      setEmailLists([]);
      setEmailListId("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [myRes, emailRes] = await Promise.all([
          fetch(`/api/my-email-lists?userId=${encodeURIComponent(userId)}`),
          fetch(`/api/email-lists?userId=${encodeURIComponent(userId)}`),
        ]);

        const [myData, emailData] = (await Promise.all([
          myRes.json(),
          emailRes.json(),
        ])) as [MyEmailList[], EmailList[]];

        if (cancelled) return;
        if (myRes.ok) {
          setMyEmailLists(myData);
          setMyEmailListId("");
        }
        if (emailRes.ok) {
          setEmailLists(emailData);
          setEmailListId("");
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSentJson(null);
    setResultJson(null);

    try {
      const payload = {
        prompt,
        useGemini,
        level,
        userId: userId ? Number(userId) : null,
        emailListId: emailListId ? Number(emailListId) : null,
        myEmailListId: myEmailListId ? Number(myEmailListId) : null,
      };
      setSentJson(JSON.stringify(payload, null, 2));

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as GenerateResponse;
      setResultJson(JSON.stringify(data, null, 2));
      if (!res.ok) {
        const maybeError =
          typeof data?.error === "string" ? data.error : undefined;
        setError(maybeError ?? `Request failed: ${res.status}`);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto grid h-[min(720px,calc(100vh-36px))] w-full max-w-[1100px] grid-cols-[300px_1fr] gap-4">
      <Card className="h-full overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-zinc-900/70">設定</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[calc(100%-44px)] flex-col gap-3 overflow-hidden">
          <div className="space-y-1">
            <Label htmlFor="userId">User（Email）</Label>
            <Select
              id="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">(指定しない)</option>
              {users.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.email}
                  {u.name ? ` (${u.name})` : ""}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="myEmailListId">MyEmailList（Email）</Label>
            <Select
              id="myEmailListId"
              value={myEmailListId}
              onChange={(e) => setMyEmailListId(e.target.value)}
              disabled={!userId}
            >
              <option value="">(指定しない)</option>
              {myEmailLists.map((m) => (
                <option key={m.id} value={String(m.id)}>
                  {m.email}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="emailListId">EmailList（Email）</Label>
            <Select
              id="emailListId"
              value={emailListId}
              onChange={(e) => setEmailListId(e.target.value)}
              disabled={!userId}
            >
              <option value="">(指定しない)</option>
              {emailLists.map((m) => (
                <option key={m.id} value={String(m.id)}>
                  {m.email}
                  {m.name ? ` (${m.name})` : ""}
                </option>
              ))}
            </Select>
          </div>

          <details className="mt-2 overflow-hidden">
            <summary className="cursor-pointer select-none text-xs font-medium text-zinc-900/60">
              JSON確認
            </summary>
            <div className="mt-2 space-y-2">
              {sentJson ? (
                <pre className="max-h-40 overflow-auto rounded-xl border border-zinc-900/10 bg-white px-3 py-2 text-xs text-zinc-900/70">
                  {sentJson}
                </pre>
              ) : null}
              {resultJson && !error ? (
                <pre className="max-h-40 overflow-auto rounded-xl border border-zinc-900/10 bg-white px-3 py-2 text-xs text-zinc-900/70">
                  {resultJson}
                </pre>
              ) : null}
            </div>
          </details>
        </CardContent>
      </Card>

      <Card className="h-full overflow-hidden">
        <CardContent className="grid h-full grid-rows-[1fr_auto_auto] gap-4 p-5">
          <div className="grid place-items-center gap-2">
            <div className="size-[clamp(140px,18vh,210px)] overflow-hidden rounded-full border border-zinc-900/15 bg-white shadow-sm">
              <Image
                src={avatarSrc}
                alt="avatar"
                width={420}
                height={420}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="text-xs text-zinc-900/60">
              {selectedUser ? selectedUser.email : "（ユーザー未指定）"}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-900/10 bg-zinc-900/[0.03] p-3">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-xs font-semibold text-zinc-900/70">
                反省度
              </span>
              <span className="font-mono text-sm text-zinc-900/60">
                {level}
              </span>
            </div>
            <Slider
              min={1}
              max={5}
              step={1}
              value={level}
              onValueChange={(v) => setLevel(v)}
            />
          </div>

          <form onSubmit={onSubmit} className="grid gap-3">
            <div className="space-y-1">
              <Label htmlFor="prompt">本音（言い訳）</Label>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="例: ゲームをしていたら、課題を出し忘れました。"
                rows={5}
                className="max-h-[220px] min-h-[140px] resize-none"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-zinc-900/70">
              <input
                type="checkbox"
                checked={useGemini}
                onChange={(e) => setUseGemini(e.target.checked)}
              />
              <span>Gemini を使う（useGemini=true）</span>
            </label>

            <Button type="submit" disabled={loading} size="lg">
              {loading ? "生成中..." : "生成する"}
            </Button>
          </form>

          {error ? (
            <div className="rounded-2xl border border-red-600/20 bg-red-600/[0.06] px-4 py-3 text-sm text-red-900/80">
              {error}
            </div>
          ) : null}

          {resultJson && !error ? (
            <pre className="max-h-40 overflow-auto rounded-2xl border border-zinc-900/10 bg-white px-4 py-3 text-xs text-zinc-900/70">
              {resultJson}
            </pre>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
