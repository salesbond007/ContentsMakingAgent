import { NextRequest, NextResponse } from "next/server";
import { verifyMagicLinkToken } from "@/lib/magicLink";
import { createSessionToken, COOKIE_NAME } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const email = token ? await verifyMagicLinkToken(token) : null;

  if (!email) {
    return NextResponse.redirect(new URL("/login?error=invalid_link", request.url));
  }

  const sessionToken = await createSessionToken();
  const res = NextResponse.redirect(new URL("/", request.url));
  res.cookies.set(COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
