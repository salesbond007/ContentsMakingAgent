/**
 * 人が手入力する必要が無いよう、半角英数字の一意なIDを自動採番する。
 * 衝突した場合は再生成する(実用上まず起こらない)。
 */
export function generateId(existingIds: string[], prefix: string): string {
  const existing = new Set(existingIds);
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = `${prefix}-${randomAlphaNumeric(6)}`;
    if (!existing.has(candidate)) return candidate;
  }
  throw new Error("IDの自動採番に失敗しました。もう一度お試しください。");
}

function randomAlphaNumeric(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}
