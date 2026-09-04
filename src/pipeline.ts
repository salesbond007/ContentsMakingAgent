import type { Env } from "./config.js";
import { createClaudeClient } from "./clients/claude.js";
import { createOpenAiClient } from "./clients/openaiImage.js";
import { MicroCmsClient } from "./clients/microcms.js";
import { notifySlack } from "./clients/slack.js";
import { collectTopics } from "./agents/research.js";
import { writeArticle } from "./agents/writing.js";
import { generateArticleImage } from "./agents/image.js";
import { reviewArticle } from "./agents/review.js";
import { publishArticle } from "./agents/publish.js";
import { withOneRetry } from "./lib/retry.js";
import { logger } from "./lib/logger.js";
import type { PipelineArticleResult, PipelineRunSummary } from "./types.js";

/**
 * 06-スケジューラ: GitHub Actions cronから1日1回起動され、工程01〜05を記事本数分ループ実行する。
 * コスト上限（1日あたりのAPI呼び出し記事数）を超える場合は実行を停止しSlackに通知する。
 */
export async function runPipeline(env: Env): Promise<PipelineRunSummary> {
  const startedAt = new Date().toISOString();
  const claude = createClaudeClient(env);
  const openai = createOpenAiClient(env);
  const microcms = new MicroCmsClient(env);

  const articleCount = Math.min(env.DAILY_ARTICLE_COUNT, env.DAILY_API_CALL_CAP);
  if (env.DAILY_ARTICLE_COUNT > env.DAILY_API_CALL_CAP) {
    await notifySlack(
      env,
      `⚠️ コスト上限(${env.DAILY_API_CALL_CAP}本)により、本日の実行数を${env.DAILY_ARTICLE_COUNT}本から${articleCount}本に制限しました。`
    );
  }

  await notifySlack(env, `▶️ BondAIメディア コンテンツ生成パイプラインを開始します（${articleCount}本予定）`);

  const topics = await collectTopics(env, claude, microcms, articleCount);
  const results: PipelineArticleResult[] = [];

  for (const topic of topics) {
    try {
      const draft = await withOneRetry(`ライティング(${topic.keyword})`, () => writeArticle(claude, topic));
      const image = await generateArticleImage(openai, draft);
      const review = await withOneRetry(`査読(${topic.keyword})`, () => reviewArticle(claude, draft, env));

      if (review.verdict === "rejected") {
        results.push({ topic, draft, image, review, status: "rejected" });
        continue;
      }

      const articleId = await publishArticle(env, microcms, draft, review, image);
      results.push({
        topic,
        draft,
        image,
        review,
        status: review.verdict === "auto-publish" ? "published" : "needs-review",
        microcmsContentId: articleId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("記事の生成に失敗したためスキップします", { keyword: topic.keyword, error: message });
      results.push({ topic, status: "skipped-error", error: message });
    }
  }

  const finishedAt = new Date().toISOString();
  await notifyCompletion(env, results);

  return { startedAt, finishedAt, results };
}

async function notifyCompletion(env: Env, results: PipelineArticleResult[]): Promise<void> {
  const published = results.filter((r) => r.status === "published").length;
  const needsReview = results.filter((r) => r.status === "needs-review");
  const rejected = results.filter((r) => r.status === "rejected").length;
  const errors = results.filter((r) => r.status === "skipped-error");

  const lines = [
    `✅ パイプライン完了: 自動公開${published}件 / 要確認${needsReview.length}件 / 差し戻し${rejected}件 / エラー${errors.length}件`,
  ];

  if (needsReview.length > 0) {
    lines.push("");
    lines.push("📝 要確認キュー:");
    for (const r of needsReview) {
      lines.push(
        `- ${r.draft?.title ?? r.topic.keyword} (score: ${r.review?.total}) — ${r.review?.comments.join(" / ")}`
      );
    }
  }

  if (errors.length > 0) {
    lines.push("");
    lines.push("🚨 エラーでスキップした記事:");
    for (const r of errors) {
      lines.push(`- ${r.topic.keyword}: ${r.error}`);
    }
  }

  await notifySlack(env, lines.join("\n"));
}
