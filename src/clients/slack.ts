import type { Env } from "../config.js";
import { logger } from "../lib/logger.js";

export async function notifySlack(env: Env, text: string): Promise<void> {
  if (!env.SLACK_WEBHOOK_URL) {
    logger.info("SLACK_WEBHOOK_URL未設定のため通知をスキップします", { text });
    return;
  }
  try {
    const res = await fetch(env.SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      logger.error("Slack通知に失敗しました", { status: res.status });
    }
  } catch (err) {
    logger.error("Slack通知でエラーが発生しました", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
