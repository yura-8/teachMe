import { NextResponse } from "next/server";

type GenerateRequest = {
  prompt?: string;
  useGemini?: boolean;
  level?: number;
  userId?: number;
  emailListId?: number;
  myEmailListId?: number;
};

function asPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

export async function POST(req: Request) {
  let body: GenerateRequest;
  try {
    body = (await req.json()) as GenerateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const useGemini = Boolean(body.useGemini);
  const level = typeof body.level === "number" ? body.level : 3;
  const userId = asPositiveNumber(body.userId);
  const emailListId = asPositiveNumber(body.emailListId);
  const myEmailListId = asPositiveNumber(body.myEmailListId);

  if (!userId || !emailListId || !myEmailListId) {
    return NextResponse.json(
      {
        error: "userId/emailListId/myEmailListId are required",
      },
      { status: 400 },
    );
  }

  // Prefer env, but also support both common setups:
  // - Frontend running in Docker (backend reachable as http://app:8080)
  // - Frontend running on host (backend reachable as http://localhost:8080)
  const candidates = [
    process.env.BACKEND_ORIGIN,
    "http://app:8080",
    "http://localhost:8080",
  ].filter((v, i, a): v is string => Boolean(v) && a.indexOf(v) === i);

  let res: Response | null = null;
  let lastError: unknown = null;
  let usedOrigin: string | null = null;

  for (const origin of candidates) {
    try {
      usedOrigin = origin;
      res = await fetch(`${origin}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          useGemini,
          level,
          userId,
          emailListId,
          myEmailListId,
        }),
      });
      break;
    } catch (err) {
      lastError = err;
      res = null;
    }
  }

  if (!res) {
    return NextResponse.json(
      {
        error: "Failed to reach backend",
        backendOriginsTried: candidates,
        detail: lastError instanceof Error ? lastError.message : String(lastError),
      },
      { status: 502 },
    );
  }

  const text = await res.text();
  try {
    const json = JSON.parse(text) as unknown;
    // If backend still returns legacy `text`, strip it since the UI consumes subject/body.
    if (json && typeof json === "object" && "text" in json) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (json as any).text;
    }
    return NextResponse.json(json, { status: res.status });
  } catch {
    // Backend should return JSON, but if it doesn't, surface it for debugging.
    return NextResponse.json(
      {
        error: "Backend returned non-JSON response",
        backendOrigin: usedOrigin,
        raw: text,
      },
      { status: 502 },
    );
  }
}
