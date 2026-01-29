"use client";

import { useState } from "react";
import styles from "./generate.module.css";

type GenerateResponse = {
  prompt: string;
  useGemini: boolean;
  text: string;
  error?: string;
};

export default function GenerateClient() {
  const [prompt, setPrompt] = useState("");
  const [useGemini, setUseGemini] = useState(false);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, useGemini }),
      });

      const data = (await res.json()) as GenerateResponse;
      if (!res.ok) {
        setError(data?.error ?? `Request failed: ${res.status}`);
        return;
      }
      setResult(data);
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
        プロンプトを入力して、バックエンド(`/generate`)で文章を生成します。
      </p>

      <form onSubmit={onSubmit} className={styles.form}>
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

      {result ? (
        <div className={styles.resultBox}>
          <div className={styles.resultMeta}>
            <span className={styles.badge}>
              useGemini: {String(result.useGemini)}
            </span>
          </div>
          <pre className={styles.resultText}>{result.text}</pre>
        </div>
      ) : null}
    </div>
  );
}

