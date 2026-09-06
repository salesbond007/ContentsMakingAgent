import crypto from "node:crypto";
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
import { publishArticle, uploadEyecatchAndResolveBody } from "./agents/publish.js";
import { loadCtas } from "./clients/ctas.js";
import { loadReferenceMaterials } from "./clients/referenceMaterials.js";
import { loadNgWords } from "./clients/ngWords.js";
import { loadSiteConfig, buildArticleUrl } from "./clients/siteConfig.js";
import { loadImageLibrary } from "./clients/imageLibrary.js";
import { loadGlobalSettings } from "./clients/globalSettings.js";
import { appendDailyStats } from "./clients/dailyStats.js";
import { appendReviewQueueItem } from "./clients/reviewQueue.js";
import { withOneRetry } from "./lib/retry.js";
import { logger } from "./lib/logger.js";
import type { PipelineArticleResult, PipelineRunSummary, Topic } from "./types.js";

/**
 * 06-スケジューラ: GitHub Actions cronから1日1回(07:00 JST)起動され、工程01〜05を記事本数分ループ実行する。
 *
 * MANUAL_KEYWORD / MANUAL_CTA_ID が設定されている場合は、workflow_dispatchからの手動実行として
 * 通常の自動キーワード収集をスキップし、指定されたキーワード・CTAで記事を生成する。
 *
 * 手動実行はAIの査読結果に関わらずmicroCMSへ直接公開せず、data/manual-review-queue.jsonの
 * 確認待ちキューに追加する。管理画面「確認待ち」ページで人間が内容を確認し、承認して初めて
 * CMSへ反映される(publishApproved.ts)。自動実行は従来通り、査読ゲートの判定に基づき
 * 自動公開／下書き保存／差し戻しを行う。
 *
 * 通知方針: 自動実行・手動実行を問わず、記事1本の処理が完了するたびに即座にSlackへ通知する
 * (公開/下書き・要確認/差し戻し/確認待ち/エラーいずれの場合もタイトル・スコア等の必要な情報を含める)。
 * 実行全体が終わった際にも、まとめの合計件数を1通送る。
 */
export async function runPipeline(env: Env): Promise<PipelineRunSummary> {
  const startedAt = new Date().toISOString();
  const claude = createClaudeClient(env);
  const openai = createOpenAiClient(env);
  const microcms = new MicroCmsClient(env);
  const ctaOptions = loadCtas(env.CTA_CONFIG_PATH);
  const referenceMaterials = loadReferenceMaterials(env.REFERENCE_MATERIALS_PATH);
  const ngWords = loadNgWords(env.NG_WORDS_PATH);
  const siteConfig = loadSiteConfig(env.SITE_CONFIG_PATH);
  const imageLibrary = loadImageLibrary(env.IMAGE_LIBRARY_PATH);
  const globalSettings = loadGlobalSettings(env.GLOBAL_SETTINGS_PATH);

  const isManualRun = !!env.MANUAL_KEYWORD || !!env.MANUAL_CTA_ID;

  // MANUAL_CTA_ID はカンマ区切りで複数指定できる。1件だけならそのCTAに固定(forcedCta)、
  // 複数ならその中からAIに選ばせる(effectiveCtaOptionsを絞り込む)、未指定なら全CTAから選ばせる。
  const manualCtaIds = (env.MANUAL_CTA_ID ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const manualCtaOptions = manualCtaIds.map((id) => {
    const found = ctaOptions.find((c) => c.id === id);
    if (!found) {
      throw new Error(`指定されたCTA ID "${id}" は config/ctas.json に存在しません。CTA一覧を確認してください。`);
    }
    return found;
  });
  const forcedCta = manualCtaOptions.length === 1 ? manualCtaOptions[0] : undefined;
  const effectiveCtaOptions = manualCtaOptions.length > 0 ? manualCtaOptions : ctaOptions;

  let topics: Topic[];
  if (isManualRun) {
    const manualSourceUrls = (env.MANUAL_SOURCE_URLS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const manualKeywords = (env.MANUAL_KEYWORD ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (manualKeywords.length > 1) {
      topics = manualKeywords.map((keyword) => ({
        keyword,
        sourceUrls: manualSourceUrls,
        source: "manual",
        notes: env.MANUAL_NOTES,
        targetProfile: env.MANUAL_TARGET,
      }));
      await notifySlack(
        env,
        `▶️ 手動実行: ${topics.length}件の記事を生成します(${manualKeywords.join(" / ")})。` +
          `完了後、管理画面の「確認待ち」で確認・承認してください。`
      );
    } else if (manualKeywords.length === 1) {
      const topic = await buildManualTopic(
        claude,
        manualKeywords[0],
        manualSourceUrls,
        forcedCta,
        env.MANUAL_NOTES,
        env.MANUAL_TARGET
      );
      topics = [topic];
      await notifySlack(
        env,
        `▶️ 手動実行: 「${topic.keyword}」の記事を1本生成します` +
          (forcedCta ? `(CTA: ${forcedCta.label})` : "") +
          `。完了後、管理画面の「確認待ち」で確認・承認してください。`
      );
    } else if (forcedCta) {
      const topic = await buildManualTopic(
        claude,
        undefined,
        manualSourceUrls,
        forcedCta,
        env.MANUAL_NOTES,
        env.MANUAL_TARGET
      );
      topics = [topic];
      await notifySlack(
        env,
        `▶️ 手動実行: 「${topic.keyword}」の記事を1本生成します(CTA: ${forcedCta.label})。` +
          `完了後、管理画面の「確認待ち」で確認・承認してください。`
      );
    } else {
      throw new Error(
        "手動実行にはキーワードを指定するか、CTAを1つだけ指定してください(CTAを複数指定する場合はキーワードも必要です)"
      );
    }
  } else if (env.DAILY_ARTICLE_COUNT === 0) {
    // 1日あたりの生成本数が0(=自動生成なし)に設定されている場合は、AI呼び出しを一切行わず終了する。
    logger.info("DAILY_ARTICLE_COUNTが0のため、本日の自動生成をスキップします");
    return { startedAt, finishedAt: new Date().toISOString(), results: [] };
  } else {
    topics = await collectTopics(env, claude, microcms, env.DAILY_ARTICLE_COUNT);
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
          effectiveCtaOptions,
          forcedCta?.id,
          referenceMaterials,
          searchIntent,
          internalLinkCandidates,
          globalSettings.mustNotViolate || undefined
        )
      );
      const image = await generateArticleImage(openai, draft, imageLibrary);
      const figures = await generateFigures(openai, draft);
      const review = await withOneRetry(`査読(${topic.keyword})`, () =>
        reviewArticle(claude, draft, env, existingArticleTitles, ngWords, globalSettings.mustNotViolate || undefined)
      );

      let result: PipelineArticleResult;

      if (isManualRun) {
        // 手動生成はAIの査読結果(自動公開/要確認/差し戻し)に関わらずCMSへ直接反映せず、
        // 人間が管理画面で確認・承認するまで確認待ちキューに置いておく。
        const { eyecatch, resolvedDraft } = await uploadEyecatchAndResolveBody(microcms, draft, image, figures);
        appendReviewQueueItem(
          {
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            draft: resolvedDraft,
            eyecatch,
            review,
          },
          env.REVIEW_QUEUE_PATH
        );
        result = { topic, draft, image, review, status: "pending-review" };
      } else if (review.verdict === "rejected") {
        result = { topic, draft, image, review, status: "rejected" };
      } else {
        const articleId = await publishArticle(env, microcms, draft, review, image, figures);
        existingArticleTitles.push(draft.title);
        if (!existingCategories.includes(draft.category)) existingCategories.push(draft.category);
        result = {
          topic,
          draft,
          image,
          review,
          status: review.verdict === "auto-publish" ? "published" : "needs-review",
          microcmsContentId: articleId,
        };
      }

      results.push(result);
      // 記事1本の処理が完了するたびに、その場でSlackに通知する(リアルタイム通知)。
      await notifySlack(env, buildResultLine(result));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("記事の生成に失敗したためスキップします", { keyword: topic.keyword, error: message });
      const result: PipelineArticleResult = { topic, status: "skipped-error", error: message };
      results.push(result);
      await notifySlack(env, buildResultLine(result));
    }
  }

  const finishedAt = new Date().toISOString();

  // 手動生成(pending-review)はまだCMSに何も反映されていないため、日次統計には含めない
  // (承認された時点でpublishApproved.ts側の公開実績としてカウントされるべきもの)。
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

  if (results.length > 1) {
    await notifySlack(env, buildTotalsLine(results));
  }

  return { startedAt, finishedAt, results };
}

/** 記事1本分の処理結果を、必要な情報(状態・タイトル・スコア等)を含む1つのSlackメッセージ文にする。 */
function buildResultLine(r: PipelineArticleResult): string {
  const title = r.draft?.title ?? r.topic.keyword;
  if (r.status === "published") {
    return `✅ 記事：記事公開しました - ${title}`;
  } else if (r.status === "needs-review") {
    return (
      `📝 記事：下書きに入れました - ${title}（要確認、スコア: ${r.review?.total}） — ${r.review?.comments.join(" / ") ?? ""}`
    );
  } else if (r.status === "rejected") {
    return `↩️ 記事：差し戻しました - ${title}（スコア: ${r.review?.total}）`;
  } else if (r.status === "pending-review") {
    return (
      `🕓 記事：ツールでの確認待ちです - ${title}（AI査読スコア: ${r.review?.total}）— 管理画面の「確認待ち」から確認・承認してください`
    );
  }
  return `🚨 記事：エラーでスキップ - ${r.topic.keyword}（${r.error}）`;
}

function buildTotalsLine(results: PipelineArticleResult[]): string {
  const published = results.filter((r) => r.status === "published").length;
  const needsReview = results.filter((r) => r.status === "needs-review").length;
  const rejected = results.filter((r) => r.status === "rejected").length;
  const pendingReview = results.filter((r) => r.status === "pending-review").length;
  const errors = results.filter((r) => r.status === "skipped-error").length;
  return `合計: 公開${published}件 / 下書き${needsReview}件 / 差し戻し${rejected}件 / 確認待ち${pendingReview}件 / エラー${errors}件`;
}
