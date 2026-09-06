import { NextRequest, NextResponse } from "next/server";
import { setRepoVariable } from "@/lib/github";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { paused?: boolean };
  await setRepoVariable("PIPELINE_PAUSED", body.paused ? "true" : "false");
  return NextResponse.json({ ok: true });
}
