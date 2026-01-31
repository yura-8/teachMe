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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/users");
        const data = (await res.json()) as User[];
        if (!res.ok) return;
        if (cancelled) return;
        setUsers(data);
        if (data.length > 0) {
          setUserId(String(data[0].id));
        }
      } catch {
        // ignore; user can still type prompt and see errors on submit
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
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
          setMyEmailListId(myData.length > 0 ? String(myData[0].id) : "");
        }
        if (emailRes.ok) {
          setEmailLists(emailData);
          setEmailListId(emailData.length > 0 ? String(emailData[0].id) : "");
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
      if (!userId || !myEmailListId || !emailListId) {
        setError("userId / myEmailListId / emailListId を選択してください");
        return;
      }

      const payload = {
        prompt,
        useGemini,
        level,
        userId: Number(userId),
        emailListId: Number(emailListId),
        myEmailListId: Number(myEmailListId),
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
    <div className={styles.panel}>
      <h1 className={styles.title}>文章生成</h1>
      <p className={styles.subtitle}>
        プロンプトを入力して、バックエンド(`/api/generate`)で文章を生成します。
      </p>

      <form onSubmit={onSubmit} className={styles.form}>
        <label className={styles.label} htmlFor="userId">
          User（Email）
        </label>
        <select
          id="userId"
          className={styles.textarea}
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        >
          {users.length === 0 ? <option value="">(ユーザーなし)</option> : null}
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
          className={styles.textarea}
          value={myEmailListId}
          onChange={(e) => setMyEmailListId(e.target.value)}
        >
          {myEmailLists.length === 0 ? (
            <option value="">(選択肢なし)</option>
          ) : null}
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
          className={styles.textarea}
          value={emailListId}
          onChange={(e) => setEmailListId(e.target.value)}
        >
          {emailLists.length === 0 ? <option value="">(選択肢なし)</option> : null}
          {emailLists.map((m) => (
            <option key={m.id} value={String(m.id)}>
              {m.email}
              {m.name ? ` (${m.name})` : ""}
            </option>
          ))}
        </select>

        <label className={styles.label} htmlFor="prompt">
          プロンプト
        </label>
        <textarea
          id="prompt"
          className={styles.textarea}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="例: 3行で自己紹介文を作って"
          rows={5}
        />

        <label className={styles.toggleRow}>
          <input
            type="checkbox"
            checked={useGemini}
            onChange={(e) => setUseGemini(e.target.checked)}
          />
          <span>Gemini を使う（useGemini=true）</span>
        </label>

        <label className={styles.label} htmlFor="level">
          反省度: {level}
        </label>
        <input
          id="level"
          type="range"
          min={1}
          max={5}
          step={1}
          value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
        />

        <button
          type="submit"
          className={styles.generateButton}
          disabled={loading}
        >
          {loading ? "生成中..." : "生成する"}
        </button>
      </form>

      {sentJson ? (
        <div className={styles.resultBox}>
          <div className={styles.resultMeta}>
            <span className={styles.badge}>送信JSON</span>
          </div>
          <pre className={styles.resultText}>{sentJson}</pre>
        </div>
      ) : null}

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
    </div>
  );
}
