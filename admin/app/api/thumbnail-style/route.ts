import { NextRequest, NextResponse } from "next/server";
import { getRepoJsonFile, updateRepoJsonFile } from "@/lib/github";
import { isTrustedOrigin } from "@/lib/security";
import type { ThumbnailStyleFile } from "@/lib/types";

export const runtime = "nodejs";

const FILE_PATH = "config/thumbnail-style.json";
const DEFAULTS: ThumbnailStyleFile = { referenceImageUrl: "", note: "" };

export async function GET() {
  const file = await getRepoJsonFile<ThumbnailStyleFile>(FILE_PATH);
  return NextResponse.json({
    referenceImageUrl: file?.data.referenceImageUrl ?? DEFAULTS.referenceImageUrl,
    note: file?.data.note ?? DEFAULTS.note,
  });
}

export async function POST(request: NextRequest) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 403 });
  }

  const body = (await request.json()) as { referenceImageUrl?: string; note?: string };
  const referenceImageUrl = body.referenceImageUrl?.trim() ?? "";
  const note = body.note?.trim() ?? "";

  if (referenceImageUrl) {
    try {
      new URL(referenceImageUrl);
    } catch {
      return NextResponse.json({ error: "参考画像URLの形式が正しくありません" }, { status: 400 });
    }
  }

  const file = await getRepoJsonFile<ThumbnailStyleFile>(FILE_PATH);
  const updated: ThumbnailStyleFile = { ...(file?.data ?? DEFAULTS), referenceImageUrl, note };

  if (file) {
    await updateRepoJsonFile(FILE_PATH, updated, file.sha, "Update thumbnail style via admin panel");
  } else {
    return NextResponse.json({ error: `${FILE_PATH} が見つかりません` }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
