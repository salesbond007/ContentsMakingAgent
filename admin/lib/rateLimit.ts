// サーバーレス環境ではインスタンスをまたいで共有されないベストエフォートのレート制限だが、
// 総当たり・メール大量送信などの誤操作・軽度の攻撃を減らす目的としては十分な抑止力になる。

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** keyごとにwindowMs内でlimit回までしか許可しない。超過していればfalseを返す。 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;

  bucket.count += 1;
  return true;
}

/** リクエストからレート制限キーに使うクライアントIPを取り出す(プロキシ経由を考慮)。 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
