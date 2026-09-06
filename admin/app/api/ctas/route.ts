import { NextRequest, NextResponse } from "next/server";
import { getRepoJsonFile, updateRepoJsonFile } from "@/lib/github";
import { isTrustedOrigin } from "@/lib/security";
import type { CtaOption, CtasFile } from "@/lib/types";

export const runtime = "nodejs";

const FILE_PATH = "config/ctas.json";

export async function GET() {
  const file = await getRepoJsonFile<CtasFile>(FILE_PATH);
  return NextResponse.json({ ctas: file?.data.ctas ?? [] });
}

export async function POST(request: NextRequest) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 403 });
  }

  const body = (await request.json()) as { ctas: CtaOption[] };

  if (!Array.isArray(body.ctas) || body.ctas.some((c) => !c.id || !c.label || !c.url || !c.buttonText)) {
    return NextResponse.json({ error: "id, label, url, buttonText はすべて必須です" }, { status: 400 });
  }

  const ids = body.ctas.map((c) => c.id);
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: "idが重複しています" }, { status: 400 });
  }

  const file = await getRepoJsonFile<CtasFile>(FILE_PATH);
  if (!file) {
    return NextResponse.json({ error: `${FILE_PATH} が見つかりません` }, { status: 404 });
  }

  const updated: CtasFile = { ...file.data, ctas: body.ctas };
  await updateRepoJsonFile(FILE_PATH, updated, file.sha, "Update CTAs via admin panel");

  return NextResponse.json({ ok: true });
}
