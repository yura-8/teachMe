import { NextResponse } from "next/server";

function backendCandidates() {
  return [process.env.BACKEND_ORIGIN, "http://app:8080", "http://localhost:8080"].filter(
    (v, i, a): v is string => Boolean(v) && a.indexOf(v) === i,
  );
}

export async function GET() {
  const candidates = backendCandidates();

  let res: Response | null = null;
  let lastError: unknown = null;

  for (const origin of candidates) {
    try {
      res = await fetch(`${origin}/api/users`, { method: "GET" });
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
    return NextResponse.json(JSON.parse(text), { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Backend returned non-JSON response", raw: text },
      { status: 502 },
    );
  }
}

