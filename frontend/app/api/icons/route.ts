import { NextResponse } from "next/server";
import { readdir } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IconEntry = {
  name: string;
  url: string;
};

const IMAGE_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".svg",
]);

async function listFilesRecursive(dirAbs: string, baseAbs: string) {
  const entries = await readdir(dirAbs, { withFileTypes: true });
  const files: string[] = [];

  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    const abs = path.join(dirAbs, ent.name);
    if (ent.isDirectory()) {
      files.push(...(await listFilesRecursive(abs, baseAbs)));
      continue;
    }
    if (!ent.isFile()) continue;
    const rel = path.relative(baseAbs, abs);
    files.push(rel);
  }
  return files;
}

export async function GET() {
  const iconsDirAbs = path.join(process.cwd(), "public", "icons");

  try {
    const relPaths = await listFilesRecursive(iconsDirAbs, iconsDirAbs);
    const icons: IconEntry[] = relPaths
      .map((p) => p.split(path.sep).join("/"))
      .filter((p) => IMAGE_EXTS.has(path.extname(p).toLowerCase()))
      .map((p) => ({
        name: p,
        url: `/icons/${p}`,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ icons }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      {
        icons: [],
        error: "Failed to list icons",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 200 },
    );
  }
}
