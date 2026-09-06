// メールのマジックリンク用トークン。Edge Middlewareでも使えるようWeb Crypto(SubtleCrypto)で署名する。

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000; // 15分

// 使用済みトークンの記録(ベストエフォート)。同一インスタンス内でのリンク再利用(メールクライアントの
// リンクプリフェッチや、リンクを踏んだ後に誤って再度開く等)を防ぐ。サーバーレスで複数インスタンスに
// またがる場合は完全には防げないが、有効期限15分と合わせて多層防御として機能する。
const consumedTokens = new Set<string>();

function scheduleForget(token: string) {
  // サーバーレス実行環境ではプロセスがすぐ終了するため、あくまでベストエフォートの掃除。
  setTimeout(() => consumedTokens.delete(token), MAGIC_LINK_TTL_MS);
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET が設定されていません");
  return secret;
}

async function hmacHex(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf-8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf-8");
}

/** メールアドレス宛のログインリンク用トークンを発行する（有効期限15分）。 */
export async function createMagicLinkToken(email: string): Promise<string> {
  const expiresAt = Date.now() + MAGIC_LINK_TTL_MS;
  const payload = base64UrlEncode(JSON.stringify({ email, expiresAt }));
  const signature = await hmacHex(payload);
  return `${payload}.${signature}`;
}

/** トークンを検証し、有効であればメールアドレスを返す。無効・期限切れ・使用済みならnull。 */
export async function verifyMagicLinkToken(token: string): Promise<string | null> {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = await hmacHex(payload);
  if (!timingSafeEqual(expected, signature)) return null;

  if (consumedTokens.has(token)) return null;

  try {
    const { email, expiresAt } = JSON.parse(base64UrlDecode(payload)) as { email: string; expiresAt: number };
    if (typeof email !== "string" || typeof expiresAt !== "number") return null;
    if (Date.now() >= expiresAt) return null;

    consumedTokens.add(token);
    scheduleForget(token);
    return email;
  } catch {
    return null;
  }
}
