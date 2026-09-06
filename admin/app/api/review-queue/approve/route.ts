import { NextRequest, NextResponse } from "next/server";
import { dispatchPublishApprovedWorkflow } from "@/lib/github";
import { isTrustedOrigin } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 403 });
  }

  const { id } = (await request.json()) as { id?: string };
  if (!id) {
    return NextResponse.json({ error: "idを指定してください" }, { status: 400 });
  }

  try {
    await dispatchPublishApprovedWorkflow(id);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "承認の反映に失敗しました" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
