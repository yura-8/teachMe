import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

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

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" } 
    });

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

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    console.log("[goiryokugoiryoku] Gemini response:", responseText);
    
    // JSONとしてパース
    const data = JSON.parse(responseText);
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