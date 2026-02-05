import { NextResponse } from "next/server";

function isQuotaExceededError(err: unknown) {
  if (!(err instanceof Error)) return false;
  return (
    err.message.includes("429") ||
    err.message.includes("Too Many Requests") ||
    err.message.includes("Quota exceeded") ||
    err.message.includes("exceeded your current quota")
  );
}

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("DEBUG: GEMINI_API_KEY is missing in Docker container");
      return NextResponse.json({ error: "API Key Missing" }, { status: 500 });
    }

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelCandidates = [
      process.env.GEMINI_VOCAB_MODEL,
      "gemini-2.0-flash-lite",
      "gemini-2.0-flash",
      "gemini-1.5-flash-latest",
    ].filter((v, i, a): v is string => Boolean(v) && a.indexOf(v) === i);

    let scoreText: string | null = null;
    let lastError: unknown = null;

    for (const modelName of modelCandidates) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });

        const prompt = `以下の文章の語彙力を1から5の数字1文字で判定して。文章: "${text}"`;

        const result = await model.generateContent(prompt);
        scoreText = result.response.text().trim();
        break;
      } catch (err) {
        lastError = err;
        if (isQuotaExceededError(err)) break;
      }
    }

    if (!scoreText) {
      const detail =
        lastError instanceof Error ? lastError.message : String(lastError);
      return NextResponse.json(
        {
          score: 3,
          fallback: true,
          error:
            "Gemini API が利用できないため、語彙スコアを仮の値(3)で返しています。",
          triedModels: modelCandidates,
          details: detail,
        },
        { status: 200 },
      );
    }
    const score = parseInt(scoreText.match(/\d/)?.[0] || "3");

    return NextResponse.json({ score });
  } catch (error) {
    console.error("DEBUG: Gemini API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
