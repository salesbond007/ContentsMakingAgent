import { loadConfig } from "./config.js";
import { readAndClearPendingNotifications } from "./clients/notificationLog.js";
import { notifySlack } from "./clients/slack.js";
import { logger } from "./lib/logger.js";

/**
 * 21:00 JST専用のエントリーポイント。毎日07:00の自動実行がdata/pending-notifications.jsonに
 * 蓄積した結果を読み出し、1通のSlackメッセージにまとめて送信したうえでファイルを空にする。
 * ワークフロー側でこのファイルの変更をコミット・pushすることで永続化する。
 */
async function main() {
  const env = loadConfig();
  const pending = readAndClearPendingNotifications(env.PENDING_NOTIFICATIONS_PATH);

  if (pending.length === 0) {
    logger.info("本日、通知すべき自動実行結果はありませんでした");
    return;
  }

  const header = `📋 本日のコンテンツ生成結果(${new Date().toLocaleDateString("ja-JP")})`;
  const message = [header, "", ...pending.flatMap((entry, i) => (i === 0 ? [entry] : ["", "---", "", entry]))].join(
    "\n"
  );

  await notifySlack(env, message);
}

main();
