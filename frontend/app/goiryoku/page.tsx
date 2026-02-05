"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import styles from "./goiryoku.module.css";

export default function GoiryokuPage() {
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    const promptBox = document.getElementById("promptBox") as HTMLTextAreaElement;
    const generateButton = document.getElementById("generateButton") as HTMLButtonElement;
    const rankNameDisplay = document.getElementById("rankName") as HTMLElement;
    const indicator = document.getElementById("indicator") as HTMLElement;
    const resultArea = document.getElementById("resultArea") as HTMLElement;
    const resultMessage = document.getElementById("resultMessage") as HTMLElement;
    const errorBox = document.getElementById("errorBox") as HTMLElement;

    // ピラミッドの各階層に合わせた高さ（%）の調整
    const RANK_MAP: Record<string, { name: string; y: string }> = {
      "5": { name: "文豪級", y: "-5%" },
      "4": { name: "准教授級", y: "25%" },
      "3": { name: "一般学生級", y: "65%" },
      "2": { name: "アメーバ級", y: "75%" },
      "1": { name: "入門級", y: "90%" },
    };

    generateButton.addEventListener("click", async () => {
      const text = promptBox.value.trim();
      if (!text) {
        errorBox.style.display = "block";
        return;
      }

      // 状態のリセット
      generateButton.disabled = true;
      generateButton.textContent = "解析中...";
      errorBox.style.display = "none";
      resultArea.style.display = "none";

      try {
        const res = await fetch("/api/goiryokugoiryoku", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (!res.ok) {
          const raw = await res.text().catch(() => "");
          let errorData: any = {};
          try {
            errorData = raw ? JSON.parse(raw) : {};
          } catch {
            errorData = { raw };
          }
          console.error("API Error Response:", errorData);
          throw new Error(
            errorData.error ||
              errorData.details ||
              (raw ? raw.slice(0, 200) : "") ||
              `API request failed with status ${res.status}`,
          );
        }

        const data = await res.json();
        const score = String(data.score || 3);
        const advice = data.advice || "apiからアドバイスが届いていません"; // フォールバック用
        const rankData = RANK_MAP[score];

        // UI更新
        indicator.style.top = rankData.y;
        rankNameDisplay.textContent = rankData.name;
        resultArea.style.display = "block";
        
        resultMessage.innerHTML = `
          <strong>【判定結果】</strong><br>
          あなたは「<span style="color: #d21414;">${rankData.name}</span>」です。<br><br>
          <strong>【AIからのアドバイス】</strong><br>
          ${advice}
        `;
        
      } catch (err) {
        console.error("Full error details:", err);
        errorBox.style.display = "block";
        errorBox.textContent = err instanceof Error ? err.message : "エラーが発生しました";
      } finally {
        generateButton.disabled = false;
        generateButton.textContent = "語彙力を判定する";
      }
    });
  }, []);

  return (
    <div className={styles.generateWrapper}>
      <div className={styles.simpleLayout}>
        <main className={styles.mainColumn}>
          
          <div className={styles.avatarArea}>
            <div className={styles.pyramidContainer}>
              <Image
                src="/Pyramid.png"
                alt="Vocabulary Pyramid"
                width={300}
                height={250}
                className={styles.pyramidImg}
                priority
              />
              
              {/* 巨大化した矢印画像インジケーター */}
              <div id="indicator" className={styles.indicator}>
                <Image
                    src="/arrow.png"  
                    alt="indicator"
                    width={150}     
                    height={150}
                    priority
                />
              </div>
            </div>
            <div className={styles.avatarCaption}>
              現在のランク: <span id="rankName" className={styles.rankHighlight}>未判定</span>
            </div>
          </div>

          <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@400&display=swap" rel="stylesheet" />
          
          <div className={styles.form}>
            <label className={styles.label}>語彙力判定</label>
            <textarea 
              id="promptBox" 
              className={styles.promptBox} 
              placeholder="文章を入力してください" 
            />
            <button id="generateButton" className={styles.generateButton}>
              語彙力を判定する
            </button>
          </div>

          {/* 結果表示 */}
          <div id="resultArea" className={styles.resultBox} style={{ display: "none" }}>
            <div id="resultMessage" className={styles.resultText}></div>
          </div>

          <div id="errorBox" className={styles.errorBox} style={{ display: "none" }}>
            <div className={styles.errorMessage}>解析に失敗しました。API設定を確認してください。</div>
          </div>
        </main>
      </div>
    </div>
  );
}
