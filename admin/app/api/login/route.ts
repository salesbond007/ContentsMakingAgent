import { NextRequest, NextResponse } from "next/server";
import { checkPassword, createSessionToken, COOKIE_NAME } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isTrustedOrigin } from "@/lib/security";

export const runtime = "nodejs";

const LOGIN_RATE_LIMIT = 8;
const LOGIN_RATE_WINDOW_MS = 10 * 60 * 1000; // 10分

export async function POST(request: NextRequest) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 403 });
  }

  const ip = getClientIp(request);
  if (!checkRateLimit(`login:${ip}`, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW_MS)) {
    return NextResponse.json(
      { error: "試行回数が多すぎます。しばらく待ってから再度お試しください" },
      { status: 429 }
    );
  }

  const { password } = (await request.json()) as { password?: string };

  if (!password || !checkPassword(password)) {
    return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 401 });
  }

  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
