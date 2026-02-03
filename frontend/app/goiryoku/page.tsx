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
      "4": { name: "准教授級", y: "15%" },
      "3": { name: "一般学生級", y: "35%" },
      "2": { name: "アメーバ級", y: "55%" },
      "1": { name: "入門級", y: "70%" },
    };

    generateButton.addEventListener("click", async () => {
      const text = promptBox.value.trim();
      if (!text) {
        errorBox.style.display = "block";
        return;
      }

      generateButton.disabled = true;
      generateButton.textContent = "解析中...";
      errorBox.style.display = "none";
      resultArea.style.display = "none";

      try {
        await new Promise((resolve) => setTimeout(resolve, 800));
        
        // 判定ロジック（文字数や語彙の複雑さのシミュレーション）
        const score = Math.min(5, Math.max(1, Math.ceil(text.length / 25))).toString();
        const data = RANK_MAP[score];

        // UI更新
        indicator.style.top = data.y;
        rankNameDisplay.textContent = data.name;
        resultArea.style.display = "block";
        resultMessage.textContent = `分析が完了しました。あなたの語彙レベルは「${data.name}」です。`;
      } catch (err) {
        errorBox.style.display = "block";
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
          
          {/* ピラミッド表示エリア */}
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
              {/* ピラミッドの横で動く矢印 */}
              {/* ピラミッドの横で動く矢印画像 */}
                <div id="indicator" className={styles.indicator}>
                <Image
                    src="/arrow.png"  
                    alt="indicator"
                    width={120}     
                    height={120}
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
            <label className={styles.label}>文章を入力</label>
            <textarea 
              id="promptBox" 
              className={styles.promptBox} 
              placeholder="判定したい文章をここに入力してください..." 
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
            <div className={styles.errorMessage}>解析する文章を入力してください。</div>
          </div>
        </main>
      </div>
    </div>
  );
}