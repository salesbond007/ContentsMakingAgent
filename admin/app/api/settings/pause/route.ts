import { NextRequest, NextResponse } from "next/server";
import { setRepoVariable } from "@/lib/github";
import { isTrustedOrigin } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 403 });
  }

  const body = (await request.json()) as { paused?: boolean };
  await setRepoVariable("PIPELINE_PAUSED", body.paused ? "true" : "false");
  return NextResponse.json({ ok: true });
}
