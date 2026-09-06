import { NextRequest, NextResponse } from "next/server";
import { dispatchContentWorkflow } from "@/lib/github";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { keyword?: string; cta_id?: string; source_urls?: string };

  if (!body.keyword?.trim() && !body.cta_id?.trim()) {
    return NextResponse.json({ error: "keywordまたはcta_idのいずれかを指定してください" }, { status: 400 });
  }

  await dispatchContentWorkflow({
    keyword: body.keyword?.trim(),
    cta_id: body.cta_id?.trim(),
    source_urls: body.source_urls?.trim(),
  });

  return NextResponse.json({ ok: true });
}
