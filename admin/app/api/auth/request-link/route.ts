import { NextRequest, NextResponse } from "next/server";
import { createMagicLinkToken } from "@/lib/magicLink";
import { sendMagicLinkEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isTrustedOrigin } from "@/lib/security";

export const runtime = "nodejs";

const REQUEST_LINK_RATE_LIMIT = 5;
const REQUEST_LINK_RATE_WINDOW_MS = 60 * 60 * 1000; // 1時間

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 403 });
  }

  const ip = getClientIp(request);
  if (!checkRateLimit(`request-link:${ip}`, REQUEST_LINK_RATE_LIMIT, REQUEST_LINK_RATE_WINDOW_MS)) {
    return NextResponse.json(
      { error: "リクエストが多すぎます。しばらく待ってから再度お試しください" },
      { status: 429 }
    );
  }

  const { email } = (await request.json()) as { email?: string };
  const normalized = email?.trim().toLowerCase();

  const allowedDomain = (process.env.ALLOWED_EMAIL_DOMAIN ?? "salesbond.jp").toLowerCase();

  if (!normalized || !EMAIL_PATTERN.test(normalized) || !normalized.endsWith(`@${allowedDomain}`)) {
    return NextResponse.json({ error: `@${allowedDomain} のメールアドレスのみログインできます` }, { status: 400 });
  }

  if (!checkRateLimit(`request-link:${normalized}`, REQUEST_LINK_RATE_LIMIT, REQUEST_LINK_RATE_WINDOW_MS)) {
    return NextResponse.json(
      { error: "このメールアドレス宛のリクエストが多すぎます。しばらく待ってから再度お試しください" },
      { status: 429 }
    );
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
