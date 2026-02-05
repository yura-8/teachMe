import { NextResponse } from "next/server";

function backendCandidates() {
  return [process.env.BACKEND_ORIGIN, "http://app:8080", "http://localhost:8080"].filter(
    (v, i, a): v is string => Boolean(v) && a.indexOf(v) === i,
  );
}

export async function POST(req: Request) {
  const candidates = backendCandidates();
  const body = await req.text();

  let res: Response | null = null;
  let resOrigin: string | null = null;
  let lastError: unknown = null;
  let lastNotFoundBody: string | null = null;

  for (const origin of candidates) {
    try {
      res = await fetch(`${origin}/vocabularies/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      resOrigin = origin;
      if (res.status === 404) {
        lastNotFoundBody = await res.text().catch(() => null);
        res = null;
        resOrigin = null;
        continue;
      }
      break;
    } catch (err) {
      lastError = err;
      res = null;
      resOrigin = null;
    }
  }

  if (!res) {
    if (lastNotFoundBody !== null) {
      return NextResponse.json(
        {
          error: "Backend endpoint not found",
          path: "/vocabularies/copy",
          backendOriginsTried: candidates,
          raw: lastNotFoundBody,
        },
        { status: 502 },
      );
    }
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
    const json = text ? JSON.parse(text) : null;
    const nextRes = NextResponse.json(json, { status: res.status });
    if (resOrigin) nextRes.headers.set("x-backend-origin", resOrigin);
    return nextRes;
  } catch {
    const nextRes = NextResponse.json(
      { error: "Backend returned non-JSON response", raw: text },
      { status: 502 },
    );
    if (resOrigin) nextRes.headers.set("x-backend-origin", resOrigin);
    return nextRes;
  }
}
