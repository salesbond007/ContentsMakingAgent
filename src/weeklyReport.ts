import { loadConfig } from "./config.js";
import { MicroCmsClient } from "./clients/microcms.js";
import { notifySlack } from "./clients/slack.js";
import { readRecentDailyStats } from "./clients/dailyStats.js";
import { findRewriteCandidates } from "./agents/rewriteCandidates.js";
import { logger } from "./lib/logger.js";

const MAX_REWRITE_CANDIDATES_SHOWN = 5;

/**
 * 週次サマリーレポート専用のエントリーポイント。週1回(GitHub Actionsのcronから)起動され、
 * 直近7日分の公開・下書き・差し戻し・エラー件数の合計と、リライト候補記事をSlackにまとめて送信する。
 * data/daily-stats.json は毎日の自動実行(runPipeline)が既に蓄積しているものを読むだけで、
 * このスクリプト自身はファイルを書き換えない。
 */
async function main() {
  const env = loadConfig();
  const microcms = new MicroCmsClient(env);

  const weekStats = readRecentDailyStats(7, env.DAILY_STATS_PATH);
  const totals = weekStats.reduce(
    (acc, e) => ({
      published: acc.published + e.published,
      needsReview: acc.needsReview + e.needsReview,
      rejected: acc.rejected + e.rejected,
      errors: acc.errors + e.errors,
    }),
    { published: 0, needsReview: 0, rejected: 0, errors: 0 }
  );

  const rewriteCandidates = await findRewriteCandidates(microcms, env.REWRITE_THRESHOLD_DAYS).catch((err) => {
    logger.warn("リライト候補の取得に失敗しました。リライト候補なしでレポートを送信します。", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  });

  const lines = [
    `📊 週次サマリー(過去7日間)`,
    "",
    `公開: ${totals.published}件 / 下書き(要確認): ${totals.needsReview}件 / 差し戻し: ${totals.rejected}件 / エラー: ${totals.errors}件`,
  ];

  if (rewriteCandidates.length > 0) {
    lines.push(
      "",
      `📝 リライト候補(公開から${env.REWRITE_THRESHOLD_DAYS}日以上経過、上位${MAX_REWRITE_CANDIDATES_SHOWN}件):`,
      ...rewriteCandidates
        .slice(0, MAX_REWRITE_CANDIDATES_SHOWN)
        .map((c) => `- ${c.title}(公開から${c.daysSincePublished}日)`)
    );
  }

  await notifySlack(env, lines.join("\n"));
}

main();
