import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("DEBUG: GEMINI_API_KEY is missing in Docker container");
      return NextResponse.json({ error: "API Key Missing" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
   const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const prompt = `以下の文章の語彙力を1から5の数字1文字で判定して。文章: "${text}"`;

    const result = await model.generateContent(prompt);
    const scoreText = result.response.text().trim();
    const score = parseInt(scoreText.match(/\d/)?.[0] || "3");

    return NextResponse.json({ score });
  } catch (error) {
    console.error("DEBUG: Gemini API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}