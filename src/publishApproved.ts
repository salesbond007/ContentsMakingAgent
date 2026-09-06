import { loadConfig } from "./config.js";
import { MicroCmsClient } from "./clients/microcms.js";
import { notifySlack } from "./clients/slack.js";
import { findReviewQueueItem, removeReviewQueueItem } from "./clients/reviewQueue.js";
import { publishApprovedArticle } from "./agents/publish.js";
import { logger } from "./lib/logger.js";

/**
 * 管理画面「確認待ち」で人間が承認した手動生成記事を、実際にmicroCMSへ反映するエントリーポイント。
 * GitHub Actionsのworkflow_dispatch(MANUAL_QUEUE_ID)経由でのみ起動される。
 * 画像アップロード・図解解決は確認待ちキューに入れる時点で完了済みのため、ここではCMSへの
 * コンテンツ作成のみを行い、承認された記事はキューから削除する。
 */
async function main() {
  const env = loadConfig();

  if (!env.MANUAL_QUEUE_ID) {
    throw new Error("MANUAL_QUEUE_ID が指定されていません。承認する記事のIDを指定してください。");
  }

  const item = findReviewQueueItem(env.MANUAL_QUEUE_ID, env.REVIEW_QUEUE_PATH);
  if (!item) {
    logger.warn("指定されたIDの確認待ち記事が見つかりませんでした(既に承認・却下済みの可能性があります)", {
      id: env.MANUAL_QUEUE_ID,
    });
    return;
  }

  const microcms = new MicroCmsClient(env);
  const articleId = await publishApprovedArticle(env, microcms, item.draft, item.review, item.eyecatch);

  removeReviewQueueItem(item.id, env.REVIEW_QUEUE_PATH);

  await notifySlack(env, `✅ 記事：記事公開しました(管理画面で承認済み) - ${item.draft.title}`);
  logger.info("承認済み記事をCMSに反映しました", { id: item.id, articleId, title: item.draft.title });
}

main();
