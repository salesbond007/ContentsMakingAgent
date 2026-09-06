import { NextRequest, NextResponse } from "next/server";
import { getRepoJsonFile, updateRepoJsonFile } from "@/lib/github";
import { isTrustedOrigin } from "@/lib/security";
import type { ReviewQueueFile } from "@/lib/types";

export const runtime = "nodejs";

const FILE_PATH = "data/manual-review-queue.json";

/** 却下: CMSには一切反映せず、確認待ちキューからそのまま削除する。 */
export async function POST(request: NextRequest) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 403 });
  }

  const { id } = (await request.json()) as { id?: string };
  if (!id) {
    return NextResponse.json({ error: "idを指定してください" }, { status: 400 });
  }

  const file = await getRepoJsonFile<ReviewQueueFile>(FILE_PATH);
  if (!file) {
    return NextResponse.json({ error: `${FILE_PATH} が見つかりません` }, { status: 404 });
  }

  const updated: ReviewQueueFile = { items: file.data.items.filter((i) => i.id !== id) };
  await updateRepoJsonFile(FILE_PATH, updated, file.sha, "Reject manually generated article via admin panel");

  return NextResponse.json({ ok: true });
}
