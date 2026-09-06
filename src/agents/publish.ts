import { MicroCmsClient } from "../clients/microcms.js";
import { toSeoFileName } from "../lib/seoFile.js";
import type { ArticleDraft, GeneratedImage, ReviewResult, RenderedFigure } from "../types.js";
import type { Env } from "../config.js";
import { logger } from "../lib/logger.js";

/**
 * 公開エージェント。査読ゲートを通過した記事をmicroCMSへ投稿する。
 * publishTargetsは常に「BondAIメディア」のみを自動設定する（コーポレートサイト等への重複掲載は人が個別判断）。
 * microCMS側のフィールドID対応は config/microcms-fields.json 経由でMicroCmsClientが解決するため、
 * ここではフィールドIDを直接扱わない。
 */
export async function publishArticle(
  env: Env,
  microcms: MicroCmsClient,
  draft: ArticleDraft,
  review: ReviewResult,
  image: GeneratedImage | undefined,
  figures: RenderedFigure[] = []
): Promise<string> {
  const { eyecatch, resolvedDraft } = await uploadEyecatchAndResolveBody(microcms, draft, image, figures);

  const status = review.verdict === "auto-publish" ? "publish" : "draft";
  const reviewWithTitleVariants = withTitleVariantsInComments(resolvedDraft, review);

  const articleId = await microcms.createArticleFromDraft(
    resolvedDraft,
    reviewWithTitleVariants,
    env.PUBLISH_TARGET_NAME,
    status,
    eyecatch
  );

  if (draft.topic.keywordRecordId) {
    await microcms.markKeywordUsed(draft.topic.keywordRecordId, articleId);
  }

  return articleId;
}

/**
 * 人間の確認を経てから公開する記事(手動生成)向けに、承認時に呼び出す。
 * 画像アップロード・図解プレースホルダー解決は確認待ちキューへ入れる時点で既に完了しているため、
 * ここではcreateArticleFromDraftを呼ぶだけでよい。承認は人間の最終判断のため、常に即時公開する。
 */
export async function publishApprovedArticle(
  env: Env,
  microcms: MicroCmsClient,
  draft: ArticleDraft,
  review: ReviewResult,
  eyecatch: { url: string; alt: string } | undefined
): Promise<string> {
  const reviewWithTitleVariants = withTitleVariantsInComments(draft, review);

  const articleId = await microcms.createArticleFromDraft(
    draft,
    reviewWithTitleVariants,
    env.PUBLISH_TARGET_NAME,
    "publish",
    eyecatch
  );

  if (draft.topic.keywordRecordId) {
    await microcms.markKeywordUsed(draft.topic.keywordRecordId, articleId);
  }

  return articleId;
}

/**
 * アイキャッチ画像をmicroCMSにアップロードし、本文中の図解プレースホルダーを実際の画像に解決する。
 * 手動生成では、この結果を確認待ちキューに保存し、承認時に再アップロードせずに済むようにする。
 */
export async function uploadEyecatchAndResolveBody(
  microcms: MicroCmsClient,
  draft: ArticleDraft,
  image: GeneratedImage | undefined,
  figures: RenderedFigure[] = []
): Promise<{ eyecatch?: { url: string; alt: string }; resolvedDraft: ArticleDraft }> {
  let eyecatch: { url: string; alt: string } | undefined;
  if (image) {
    const fileName = toSeoFileName(draft.title, "eyecatch", "png");
    const uploaded = await microcms.uploadMedia(image.buffer, fileName, image.mimeType);
    eyecatch = { url: uploaded.url, alt: image.altText };
  }

  const resolvedDraft: ArticleDraft = { ...draft, body: await resolveFigurePlaceholders(microcms, draft, figures) };

  return { eyecatch, resolvedDraft };
}

function withTitleVariantsInComments(draft: ArticleDraft, review: ReviewResult): ReviewResult {
  return draft.altTitles && draft.altTitles.length > 0
    ? { ...review, comments: [...review.comments, `タイトル代替案: ${draft.altTitles.join(" / ")}`] }
    : review;
}

/**
 * 本文中の `[[FIGURE:token]]` プレースホルダーを、実際にアップロードした図解の<img>タグに置き換える。
 * 対応する図解が無い（生成失敗も含む）プレースホルダーは、そのまま表示されないよう除去する。
 */
async function resolveFigurePlaceholders(
  microcms: MicroCmsClient,
  draft: ArticleDraft,
  figures: RenderedFigure[]
): Promise<string> {
  let body = draft.body;

  for (const figure of figures) {
    const placeholder = `[[FIGURE:${figure.token}]]`;
    if (!body.includes(placeholder)) continue;

    try {
      const extension = figure.mimeType === "image/svg+xml" ? "svg" : "png";
      const fileName = toSeoFileName(draft.title, `figure-${figure.token}`, extension);
      const uploaded = await microcms.uploadMedia(figure.buffer, fileName, figure.mimeType);
      body = body.replaceAll(
        placeholder,
        `<img src="${uploaded.url}" alt="${escapeHtmlAttr(figure.altText)}" />`
      );
    } catch (err) {
      logger.error("図解のアップロードに失敗しました。この図解なしで続行します。", {
        title: draft.title,
        token: figure.token,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 生成・アップロードに失敗した図解のプレースホルダーが本文に残っていれば除去する。
  return body.replace(/\[\[FIGURE:[^\]]+\]\]/g, "");
}

function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
