import { loadConfig } from "./config.js";
import { runPipeline } from "./pipeline.js";
import { notifySlack } from "./clients/slack.js";
import { logger } from "./lib/logger.js";

async function main() {
  const env = loadConfig();
  try {
    const summary = await runPipeline(env);
    logger.info("パイプライン実行完了", { summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("パイプライン全体でエラーが発生しました", { error: message });
    await notifySlack(env, `🚨 パイプライン全体でエラーが発生しました: ${message}`);
    process.exitCode = 1;
  }
}

main();
