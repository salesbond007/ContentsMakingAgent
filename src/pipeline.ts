import type { Env } from "./config.js";
import { createClaudeClient } from "./clients/claude.js";
import { createOpenAiClient } from "./clients/openaiImage.js";
import { MicroCmsClient } from "./clients/microcms.js";
import { notifySlack } from "./clients/slack.js";
import { buildManualTopic, collectTopics } from "./agents/research.js";
import { writeArticle } from "./agents/writing.js";
import { generateArticleImage, generateFigures } from "./agents/image.js";
import { analyzeSearchIntent } from "./agents/searchIntent.js";
import { reviewArticle } from "./agents/review.js";
import { publishArticle } from "./agents/publish.js";
import { loadCtas } from "./clients/ctas.js";
import { loadStyleReferences } from "./clients/styleReferences.js";
import { loadNgWords } from "./clients/ngWords.js";
import { loadSiteConfig, buildArticleUrl } from "./clients/siteConfig.js";
import { loadThumbnailStyle } from "./clients/thumbnailStyle.js";
import { appendPendingNotification } from "./clients/notificationLog.js";
import { appendDailyStats } from "./clients/dailyStats.js";
import { withOneRetry } from "./lib/retry.js";
import { logger } from "./lib/logger.js";
import type { PipelineArticleResult, PipelineRunSummary, Topic } from "./types.js";

/**
 * 06-スケジューラ: GitHub Actions cronから1日1回(07:00 JST)起動され、工程01〜05を記事本数分ループ実行する。
 * コスト上限（1日あたりのAPI呼び出し記事数）を超える場合は実行を停止しSlackに通知する。
 *
 * MANUAL_KEYWORD / MANUAL_CTA_ID が設定されている場合は、workflow_dispatchからの手動実行として
 * 通常の自動キーワード収集をスキップし、指定されたキーワード・CTAで1本だけ記事を生成する。
 *
 * 通知方針: 手動実行はその場でSlackに結果を通知する（管理画面から見て分かりやすくするため）。
 * 一方、毎日の自動実行はリアルタイム通知せず、結果をdata/pending-notifications.jsonに蓄積するだけにし、
 * 別ワークフロー(21:00 JST)がまとめて1通のSlackメッセージとして送信する。
 */
export async function runPipeline(env: Env): Promise<PipelineRunSummary> {
  const startedAt = new Date().toISOString();
  const claude = createClaudeClient(env);
  const openai = createOpenAiClient(env);
  const microcms = new MicroCmsClient(env);
  const ctaOptions = loadCtas(env.CTA_CONFIG_PATH);
  const styleReferences = loadStyleReferences(env.STYLE_REFERENCES_PATH);
  const ngWords = loadNgWords(env.NG_WORDS_PATH);
  const siteConfig = loadSiteConfig(env.SITE_CONFIG_PATH);
  const thumbnailStyle = loadThumbnailStyle(env.THUMBNAIL_STYLE_PATH);

  const isManualRun = !!env.MANUAL_KEYWORD || !!env.MANUAL_CTA_ID;
  const forcedCta = env.MANUAL_CTA_ID ? ctaOptions.find((c) => c.id === env.MANUAL_CTA_ID) : undefined;
  if (env.MANUAL_CTA_ID && !forcedCta) {
    throw new Error(
      `指定されたCTA ID "${env.MANUAL_CTA_ID}" は config/ctas.json に存在しません。CTA一覧を確認してください。`
    );
  }

  let topics: Topic[];
  let costCapNote: string | undefined;
  if (isManualRun) {
    const manualSourceUrls = (env.MANUAL_SOURCE_URLS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const topic = await buildManualTopic(claude, env.MANUAL_KEYWORD, manualSourceUrls, forcedCta);
    topics = [topic];
    await notifySlack(
      env,
      `▶️ 手動実行: 「${topic.keyword}」の記事を1本生成します` +
        (forcedCta ? `(CTA: ${forcedCta.label})` : "")
    );
  } else {
    const articleCount = Math.min(env.DAILY_ARTICLE_COUNT, env.DAILY_API_CALL_CAP);
    if (env.DAILY_ARTICLE_COUNT > env.DAILY_API_CALL_CAP) {
      costCapNote = `⚠️ コスト上限(${env.DAILY_API_CALL_CAP}本)により、本日の実行数を${env.DAILY_ARTICLE_COUNT}本から${articleCount}本に制限しました。`;
    }
    topics = await collectTopics(env, claude, microcms, articleCount);
  }

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

  // 内部リンク自動提案用。サイトのURLパターンが未設定の場合は誤ったリンクを避けるため取得自体を行わない。
  const internalLinkCandidates = siteConfig.articleUrlPattern
    ? await microcms
        .getArticlesForInternalLinking()
        .then((articles) =>
          articles.map((a) => ({ title: a.title, url: buildArticleUrl(siteConfig.articleUrlPattern, a.id) }))
        )
        .catch((err) => {
          logger.warn("内部リンク候補の取得に失敗しました。内部リンク提案なしで続行します。", {
            error: err instanceof Error ? err.message : String(err),
          });
          return [];
        })
    : [];

  for (const topic of topics) {
    try {
      const searchIntent = await analyzeSearchIntent(claude, topic);
      const draft = await withOneRetry(`ライティング(${topic.keyword})`, () =>
        writeArticle(
          claude,
          topic,
          existingCategories,
          ctaOptions,
          forcedCta?.id,
          styleReferences,
          searchIntent,
          internalLinkCandidates
        )
      );
      const image = await generateArticleImage(openai, draft, thumbnailStyle);
      const figures = await generateFigures(openai, draft);
      const review = await withOneRetry(`査読(${topic.keyword})`, () =>
        reviewArticle(claude, draft, env, existingArticleTitles, ngWords)
      );

      if (review.verdict === "rejected") {
        results.push({ topic, draft, image, review, status: "rejected" });
        continue;
      }

      const articleId = await publishArticle(env, microcms, draft, review, image, figures);
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
  const digest = buildCompletionDigest(results, costCapNote);

  appendDailyStats(
    {
      date: finishedAt.slice(0, 10),
      published: results.filter((r) => r.status === "published").length,
      needsReview: results.filter((r) => r.status === "needs-review").length,
      rejected: results.filter((r) => r.status === "rejected").length,
      errors: results.filter((r) => r.status === "skipped-error").length,
    },
    env.DAILY_STATS_PATH
  );

  if (isManualRun) {
    // 手動実行は管理画面から見て分かりやすいよう、その場で通知する。
    await notifySlack(env, digest);
  } else {
    // 自動実行はリアルタイム通知せず蓄積し、21:00 JSTの別ワークフローがまとめて送信する。
    appendPendingNotification(digest, env.PENDING_NOTIFICATIONS_PATH);
  }

  return { startedAt, finishedAt, results };
}

function buildCompletionDigest(results: PipelineArticleResult[], costCapNote?: string): string {
  const lines: string[] = [];
  if (costCapNote) lines.push(costCapNote, "");

  for (const r of results) {
    const title = r.draft?.title ?? r.topic.keyword;
    if (r.status === "published") {
      lines.push(`✅ 記事：記事公開しました - ${title}`);
    } else if (r.status === "needs-review") {
      lines.push(
        `📝 記事：下書きに入れました - ${title}（要確認、スコア: ${r.review?.total}） — ${r.review?.comments.join(" / ") ?? ""}`
      );
    } else if (r.status === "rejected") {
      lines.push(`↩️ 記事：差し戻しました - ${title}（スコア: ${r.review?.total}）`);
    } else {
      lines.push(`🚨 記事：エラーでスキップ - ${r.topic.keyword}（${r.error}）`);
    }
  }

  const published = results.filter((r) => r.status === "published").length;
  const needsReview = results.filter((r) => r.status === "needs-review").length;
  const rejected = results.filter((r) => r.status === "rejected").length;
  const errors = results.filter((r) => r.status === "skipped-error").length;
  lines.push("", `合計: 公開${published}件 / 下書き${needsReview}件 / 差し戻し${rejected}件 / エラー${errors}件`);

  return lines.join("\n");
}
