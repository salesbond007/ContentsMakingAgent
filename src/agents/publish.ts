import { MicroCmsClient } from "../clients/microcms.js";
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
  let eyecatch: { url: string; alt: string } | undefined;
  if (image) {
    const uploaded = await microcms.uploadMedia(image.buffer, `${Date.now()}-eyecatch.png`, image.mimeType);
    eyecatch = { url: uploaded.url, alt: image.altText };
  }

  const resolvedDraft: ArticleDraft = { ...draft, body: await resolveFigurePlaceholders(microcms, draft, figures) };

  const status = review.verdict === "auto-publish" ? "publish" : "draft";

  const articleId = await microcms.createArticleFromDraft(
    resolvedDraft,
    review,
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
      const uploaded = await microcms.uploadMedia(
        figure.buffer,
        `${Date.now()}-figure-${figure.token}.${extension}`,
        figure.mimeType
      );
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
