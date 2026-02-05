import { NextResponse } from "next/server";

function tryParseJsonObject(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Some LLMs wrap JSON with markdown fences or extra text. Try to extract the first JSON object.
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON object found in model response");
    return JSON.parse(match[0]);
  }
}

function isModelNotFoundError(err: unknown) {
  if (!(err instanceof Error)) return false;
  return (
    err.message.includes("404") ||
    err.message.includes("is not found for API version") ||
    err.message.includes("not supported for generateContent")
  );
}

function isQuotaExceededError(err: unknown) {
  if (!(err instanceof Error)) return false;
  return (
    err.message.includes("429") ||
    err.message.includes("Too Many Requests") ||
    err.message.includes("Quota exceeded") ||
    err.message.includes("exceeded your current quota")
  );
}

function fallbackScore(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return 1;

  const tokens = trimmed
    .split(/[\s、。,．.！!？?「」『』（）()［\]【】\n\r\t]+/g)
    .map((t) => t.trim())
    .filter(Boolean);

  const unique = new Set(tokens.map((t) => t.toLowerCase()));
  const uniqueRatio = tokens.length ? unique.size / tokens.length : 0;

  // Rough heuristic: longer + more varied -> higher score.
  const lengthScore =
    trimmed.length >= 240 ? 3 : trimmed.length >= 120 ? 2 : 1;
  const varietyScore =
    uniqueRatio >= 0.85 ? 2 : uniqueRatio >= 0.7 ? 1 : 0;

  const score = Math.max(1, Math.min(5, lengthScore + varietyScore));
  return score;
}

export async function POST(req: Request) {
  try {
    console.log("[goiryokugoiryoku] POST request received");
    
    const { text } = await req.json();
    console.log("[goiryokugoiryoku] Text received:", text?.substring(0, 50));
    
    const apiKey = process.env.GEMINI_API_KEY;
    console.log("[goiryokugoiryoku] API Key exists:", !!apiKey);

    if (!apiKey) {
      console.error("[goiryokugoiryoku] API Key Missing");
      return NextResponse.json({ error: "API Key Missing" }, { status: 500 });
    }
    
    if (!text || text.trim().length === 0) {
      console.error("[goiryokugoiryoku] No text provided");
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    // Dynamic import so the route still returns JSON even if the dependency isn't installed in the runtime container.
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);

    const modelCandidates = [
      process.env.GEMINI_GOIRYOKU_MODEL,
      // Prefer stable/latest aliases first.
      "gemini-1.5-flash-latest",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-1.5-flash-8b",
    ].filter((v, i, a): v is string => Boolean(v) && a.indexOf(v) === i);

   const prompt = `
  あなたは超一流の言語学者であり、文芸評論家です。
  以下の文章を「語彙の重複」「表現の具体性」「知的な言い回し」の観点から、1〜5の5段階で厳密に査定してください。

  【厳守ルール】
  
  2. 必ず、入力された文章の中から「具体的な単語やフレーズ」を1つ以上引用して、その使い方や改善点を指摘してください。
  3. 「この言葉を〇〇と言い換えると、より語彙力が高い印象になります」という具体的な言い換え案を1つ以上提示してください。

  出力は必ず以下のJSON形式にしてください：
  {
    "score": 数値(1-5),
    "advice": "【分析】(引用を含む具体的な分析)\\n【改善案】(具体的な言い換え提案)\\n"
  }

  文章: "${text}"
`;

    let responseText: string | null = null;
    let lastError: unknown = null;

    for (const modelName of modelCandidates) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: "application/json" },
        });

        const result = await model.generateContent(prompt);
        responseText = result.response.text();
        console.log("[goiryokugoiryoku] Model used:", modelName);
        console.log("[goiryokugoiryoku] Gemini response:", responseText);
        break;
      } catch (err) {
        lastError = err;
        if (isQuotaExceededError(err)) {
          const score = fallbackScore(text);
          return NextResponse.json(
            {
              score,
              advice:
                "現在、Gemini API の利用上限（クォータ/課金設定）が原因で解析できませんでした。代替の簡易判定結果を表示しています。\n" +
                "（対策）Google AI Studio 側で Gemini API のクォータ/課金/有効化設定を確認してください。",
              fallback: true,
              details: err instanceof Error ? err.message : String(err),
            },
            { status: 200 },
          );
        }
        if (isModelNotFoundError(err)) {
          console.warn("[goiryokugoiryoku] Model not available:", modelName);
          continue;
        }
        throw err;
      }
    }

    if (!responseText) {
      const detail =
        lastError instanceof Error ? lastError.message : String(lastError);
      const score = fallbackScore(text);
      return NextResponse.json(
        {
          score,
          advice:
            "Gemini API のモデルが見つからない/利用できないため、代替の簡易判定結果を表示しています。\n" +
            "（対策）利用可能なモデル名を確認し、必要なら `GEMINI_GOIRYOKU_MODEL` を設定してください。",
          fallback: true,
          triedModels: modelCandidates,
          details: detail,
        },
        { status: 200 },
      );
    }
    
    // JSONとしてパース（失敗したらJSON部分を抽出して再試行）
    const data = tryParseJsonObject(responseText) as {
      score?: number;
      advice?: string;
    };
    console.log("[goiryokugoiryoku] Parsed data:", data);

    return NextResponse.json({ 
      score: data.score, 
      advice: data.advice 
    });
  } catch (error) {
    console.error("[goiryokugoiryoku] Error details:", error);
    
    // エラーメッセージをより詳細に
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("[goiryokugoiryoku] Error message:", errorMessage);
    
    return NextResponse.json({ 
      error: "Internal Server Error",
      details: errorMessage 
    }, { status: 500 });
  }
}
