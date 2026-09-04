import { MicroCmsClient } from "../clients/microcms.js";
import type { ArticleDraft, GeneratedImage, ReviewResult } from "../types.js";
import type { Env } from "../config.js";

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
  image: GeneratedImage | undefined
): Promise<string> {
  let eyecatch: { url: string; alt: string } | undefined;
  if (image) {
    const uploaded = await microcms.uploadMedia(image.buffer, `${Date.now()}-eyecatch.png`, image.mimeType);
    eyecatch = { url: uploaded.url, alt: image.altText };
  }

  const status = review.verdict === "auto-publish" ? "publish" : "draft";

  const articleId = await microcms.createArticleFromDraft(draft, review, env.PUBLISH_TARGET_NAME, status, eyecatch);

  if (draft.topic.keywordRecordId) {
    await microcms.markKeywordUsed(draft.topic.keywordRecordId, articleId);
  }

  return articleId;
}
