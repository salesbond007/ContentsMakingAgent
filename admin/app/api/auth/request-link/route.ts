import { NextRequest, NextResponse } from "next/server";
import { createMagicLinkToken } from "@/lib/magicLink";
import { sendMagicLinkEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { email } = (await request.json()) as { email?: string };
  const normalized = email?.trim().toLowerCase();

  const allowedDomain = (process.env.ALLOWED_EMAIL_DOMAIN ?? "salesbond.jp").toLowerCase();

  if (!normalized || !normalized.endsWith(`@${allowedDomain}`)) {
    return NextResponse.json({ error: `@${allowedDomain} のメールアドレスのみログインできます` }, { status: 400 });
  }

  const token = await createMagicLinkToken(normalized);
  const origin = request.nextUrl.origin;
  const link = `${origin}/api/auth/verify?token=${encodeURIComponent(token)}`;

  try {
    await sendMagicLinkEmail(normalized, link);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "メール送信に失敗しました" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
