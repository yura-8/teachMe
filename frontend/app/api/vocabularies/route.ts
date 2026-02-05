import { NextResponse } from "next/server";

function backendCandidates() {
  return [process.env.BACKEND_ORIGIN, "http://app:8080", "http://localhost:8080"].filter(
    (v, i, a): v is string => Boolean(v) && a.indexOf(v) === i,
  );
}

async function proxyToBackend(req: Request, init: RequestInit & { path: string }) {
  const candidates = backendCandidates();
  let res: Response | null = null;
  let resOrigin: string | null = null;
  let lastError: unknown = null;
  let lastNotFoundBody: string | null = null;

  for (const origin of candidates) {
    try {
      res = await fetch(`${origin}${init.path}`, init);
      resOrigin = origin;
      if (res.status === 404) {
        // If one candidate returns Not Found, try the next origin (common when BACKEND_ORIGIN is misconfigured).
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
          path: init.path,
          backendOriginsTried: candidates,
          raw: lastNotFoundBody,
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        error: "Failed to reach backend",
        path: init.path,
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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id") ?? "";
  const profId = url.searchParams.get("prof_id") ?? "";

  const qs = new URLSearchParams();
  if (userId) qs.set("user_id", userId);
  if (profId) qs.set("prof_id", profId);

  const path = `/vocabularies${qs.toString() ? `?${qs.toString()}` : ""}`;
  return proxyToBackend(req, { method: "GET", path });
}

export async function POST(req: Request) {
  const body = await req.text();
  return proxyToBackend(req, {
    method: "POST",
    path: "/vocabularies",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

export async function DELETE(req: Request) {
  const body = await req.text();
  return proxyToBackend(req, {
    method: "DELETE",
    path: "/vocabularies",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
