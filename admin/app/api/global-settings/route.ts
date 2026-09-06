import { NextRequest, NextResponse } from "next/server";
import { getRepoJsonFile, updateRepoJsonFile } from "@/lib/github";
import { isTrustedOrigin } from "@/lib/security";
import type { GlobalSettingsFile } from "@/lib/types";

export const runtime = "nodejs";

const FILE_PATH = "config/global-settings.json";
const DEFAULTS: GlobalSettingsFile = { mustNotViolate: "" };

export async function GET() {
  const file = await getRepoJsonFile<GlobalSettingsFile>(FILE_PATH);
  return NextResponse.json({ mustNotViolate: file?.data.mustNotViolate ?? DEFAULTS.mustNotViolate });
}

export async function POST(request: NextRequest) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 403 });
  }

  const body = (await request.json()) as { mustNotViolate?: string };
  const mustNotViolate = body.mustNotViolate?.trim() ?? "";

  const file = await getRepoJsonFile<GlobalSettingsFile>(FILE_PATH);
  const updated: GlobalSettingsFile = { ...(file?.data ?? DEFAULTS), mustNotViolate };

  if (file) {
    await updateRepoJsonFile(FILE_PATH, updated, file.sha, "Update global settings via admin panel");
  } else {
    return NextResponse.json({ error: `${FILE_PATH} が見つかりません` }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
