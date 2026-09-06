import { NextRequest } from "next/server";

/**
 * CSRF対策として、状態変更系のAPI RouteはOriginヘッダがこのアプリ自身のオリジンと
 * 一致する場合のみ受け付ける。Originヘッダが無いリクエスト(一部の古いブラウザ・ツール経由)は
 * 誤検知を避けるため許可する(このアプリはセッションCookieがSameSite=laxのため、通常のクロスサイト
 * フォーム送信によるCSRFは元々成立しないが、多層防御として追加する)。
 */
export function isTrustedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === request.nextUrl.origin;
}
