import { NextRequest, NextResponse } from "next/server";
import { appendJsonArrayEntry, dispatchContentWorkflow, getRepoJsonFile } from "@/lib/github";
import { isTrustedOrigin } from "@/lib/security";

export const runtime = "nodejs";

const LOG_PATH = "data/manual-generate-requests.json";

interface GenerateRequestLogEntry {
  keyword: string | null;
  ctaId: string | null;
  sourceUrls: string | null;
  notes: string | null;
  requestedAt: string;
}

export async function GET() {
  const file = await getRepoJsonFile<{ requests: GenerateRequestLogEntry[] }>(LOG_PATH);
  const requests = (file?.data.requests ?? []).slice().reverse(); // 新しい順
  return NextResponse.json({ requests });
}

export async function POST(request: NextRequest) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 403 });
  }

  const body = (await request.json()) as {
    keyword?: string;
    cta_id?: string;
    source_urls?: string;
    notes?: string;
  };
  const keyword = body.keyword?.trim();
  const ctaId = body.cta_id?.trim();
  const sourceUrls = body.source_urls?.trim();
  const notes = body.notes?.trim();

  if (!keyword && !ctaId) {
    return NextResponse.json({ error: "keywordまたはcta_idのいずれかを指定してください" }, { status: 400 });
  }

  await dispatchContentWorkflow({ keyword, cta_id: ctaId, source_urls: sourceUrls, notes });

  // ワークフロー発火が成功した後にログを残す。ログ保存自体の失敗で生成リクエストを失敗扱いにはしない。
  try {
    await appendJsonArrayEntry<GenerateRequestLogEntry>(
      LOG_PATH,
      "requests",
      {
        keyword: keyword ?? null,
        ctaId: ctaId ?? null,
        sourceUrls: sourceUrls ?? null,
        notes: notes ?? null,
        requestedAt: new Date().toISOString(),
      },
      "Log manual generate request via admin panel"
    );
  } catch {
    // ログ保存の失敗は無視する(生成リクエスト自体は既に成功しているため)。
  }

  return NextResponse.json({ ok: true });
}
