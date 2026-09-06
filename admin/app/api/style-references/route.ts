import { NextRequest, NextResponse } from "next/server";
import { getRepoJsonFile, updateRepoJsonFile } from "@/lib/github";
import { isTrustedOrigin } from "@/lib/security";
import type { StyleReference, StyleReferencesFile } from "@/lib/types";

export const runtime = "nodejs";

const FILE_PATH = "config/style-references.json";

export async function GET() {
  const file = await getRepoJsonFile<StyleReferencesFile>(FILE_PATH);
  return NextResponse.json({ references: file?.data.references ?? [] });
}

export async function POST(request: NextRequest) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 403 });
  }

  const body = (await request.json()) as { references: StyleReference[] };

  if (!Array.isArray(body.references) || body.references.some((r) => !r.label || !r.url)) {
    return NextResponse.json({ error: "label, url は必須です" }, { status: 400 });
  }

  const file = await getRepoJsonFile<StyleReferencesFile>(FILE_PATH);
  if (!file) {
    return NextResponse.json({ error: `${FILE_PATH} が見つかりません` }, { status: 404 });
  }

  const updated: StyleReferencesFile = { ...file.data, references: body.references };
  await updateRepoJsonFile(FILE_PATH, updated, file.sha, "Update style references via admin panel");

  return NextResponse.json({ ok: true });
}
