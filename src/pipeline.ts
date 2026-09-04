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

  // 査読エージェントの「剽窃・重複」判定用に既存記事タイトルを取得（取得失敗時は空扱いで続行）。
  // 同一実行内で公開した記事タイトルも都度追加し、1回のバッチ内での重複も検知できるようにする。
  const existingArticleTitles = await microcms.getRecentArticleTitles().catch((err) => {
    logger.warn("既存記事タイトルの取得に失敗しました。重複チェックなしで続行します。", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [] as string[];
  });

  // カテゴリの表記ゆれ防止用。取得失敗時は空扱いにし、ライティングエージェントが新規カテゴリを作成する。
  const existingCategories = await microcms.getRecentCategories().catch((err) => {
    logger.warn("既存カテゴリの取得に失敗しました。カテゴリ再利用なしで続行します。", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [] as string[];
  });

  for (const topic of topics) {
    try {
      const draft = await withOneRetry(`ライティング(${topic.keyword})`, () =>
        writeArticle(claude, topic, existingCategories)
      );
      const image = await generateArticleImage(openai, draft);
      const review = await withOneRetry(`査読(${topic.keyword})`, () =>
        reviewArticle(claude, draft, env, existingArticleTitles)
      );

      if (review.verdict === "rejected") {
        results.push({ topic, draft, image, review, status: "rejected" });
        continue;
      }

      const articleId = await publishArticle(env, microcms, draft, review, image);
      existingArticleTitles.push(draft.title);
      if (!existingCategories.includes(draft.category)) existingCategories.push(draft.category);
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
