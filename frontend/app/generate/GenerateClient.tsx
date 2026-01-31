"use client";

import { useEffect, useState } from "react";
import styles from "./generate.module.css";

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
    <div className={styles.layout}>
      <aside className={styles.sidePanel}>
        <div className={styles.sideTitle}>設定</div>

        <label className={styles.label} htmlFor="userId">
          User（Email）
        </label>
        <select
          id="userId"
          className={styles.select}
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
        </select>

        <label className={styles.label} htmlFor="myEmailListId">
          MyEmailList（Email）
        </label>
        <select
          id="myEmailListId"
          className={styles.select}
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
        </select>

        <label className={styles.label} htmlFor="emailListId">
          EmailList（Email）
        </label>
        <select
          id="emailListId"
          className={styles.select}
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
        </select>

        <details className={styles.details}>
          <summary className={styles.detailsSummary}>JSON確認</summary>
          {sentJson ? (
            <div className={styles.resultBox}>
              <div className={styles.resultMeta}>
                <span className={styles.badge}>送信JSON</span>
              </div>
              <pre className={styles.resultText}>{sentJson}</pre>
            </div>
          ) : null}
          {resultJson && !error ? (
            <div className={styles.resultBox}>
              <div className={styles.resultMeta}>
                <span className={styles.badge}>レスポンスJSON</span>
              </div>
              <pre className={styles.resultText}>{resultJson}</pre>
            </div>
          ) : null}
        </details>
      </aside>

      <main className={styles.mainColumn}>
        <div className={styles.avatarArea}>
          <div className={styles.avatarRing}>
            <img
              className={styles.avatarImg}
              src={avatarSrc}
              alt="avatar"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className={styles.avatarCaption}>
            {selectedUser ? selectedUser.email : "（ユーザー未指定）"}
          </div>
        </div>

        <div className={styles.sliderArea}>
          <div className={styles.sliderHeader}>
            <span className={styles.sliderLabel}>反省度</span>
            <span className={styles.sliderValue}>{level}</span>
          </div>
          <input
            className={styles.slider}
            id="level"
            type="range"
            min={1}
            max={5}
            step={1}
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
          />
        </div>

        <form onSubmit={onSubmit} className={styles.form}>
          <label className={styles.label} htmlFor="prompt">
            本音（言い訳）
          </label>
          <textarea
            id="prompt"
            className={styles.promptBox}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="例: ゲームをしていたら、課題を出し忘れました。"
          />

          <label className={styles.toggleRow}>
            <input
              type="checkbox"
              checked={useGemini}
              onChange={(e) => setUseGemini(e.target.checked)}
            />
            <span>Gemini を使う（useGemini=true）</span>
          </label>

          <button
            type="submit"
            className={styles.generateButton}
            disabled={loading}
          >
            {loading ? "生成中..." : "生成する"}
          </button>
        </form>

        {error ? (
          <div className={styles.errorBox}>
            <div className={styles.errorTitle}>エラー</div>
            <div className={styles.errorMessage}>{error}</div>
          </div>
        ) : null}

        {resultJson && !error ? (
          <div className={styles.resultBox}>
            <div className={styles.resultMeta}>
              <span className={styles.badge}>レスポンスJSON</span>
            </div>
            <pre className={styles.resultText}>{resultJson}</pre>
          </div>
        ) : null}
      </main>
    </div>
  );
}
