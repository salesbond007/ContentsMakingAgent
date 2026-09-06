/**
 * Anthropic/OpenAIのAPIエラーが「残高不足・利用上限到達」によるものかを判定する。
 * 通常の一時的なエラー(タイムアウト、5xx等)とは区別し、この場合は記事の生成をリトライしても
 * 無駄なため、パイプライン全体を即座に中断してSlackに知らせる必要がある。
 * SDKのエラー形状はバージョンによって変わりうるため、statusコードとメッセージ文言の両方で判定する。
 */
export function isBillingError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;

  const status = "status" in err ? (err as { status?: unknown }).status : undefined;
  const message = err instanceof Error ? err.message : String(err);

  if (status === 402) return true; // Payment Required
  if (status === 429 && /credit|quota|billing/i.test(message)) return true;

  return /credit balance is too low|insufficient_quota|exceeded your current quota|billing hard limit|payment required/i.test(
    message
  );
}
