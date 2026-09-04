import { MicroCmsClient } from "../clients/microcms.js";
import type { ArticleDraft, GeneratedImage, ReviewResult } from "../types.js";
import type { Env } from "../config.js";

/**
 * 公開エージェント。査読ゲートを通過した記事をmicroCMSへ投稿する。
 * publishTargetsは常に「BondAIメディア」のみを自動設定する（コーポレートサイト等への重複掲載は人が個別判断）。
 */
export async function publishArticle(
  env: Env,
  microcms: MicroCmsClient,
  draft: ArticleDraft,
  review: ReviewResult,
  image: GeneratedImage | undefined
): Promise<string> {
  let eyecatch: { url: string } | undefined;
  if (image) {
    eyecatch = await microcms.uploadMedia(image.buffer, `${Date.now()}-eyecatch.png`, image.mimeType);
  }

  const status = review.verdict === "auto-publish" ? "publish" : "draft";

  const articleId = await microcms.createArticle(
    {
      title: draft.title,
      excerpt: draft.excerpt,
      body: draft.body,
      category: draft.category,
      tags: draft.tags,
      seo: draft.seo,
      ...(eyecatch ? { eyecatch: { url: eyecatch.url }, eyecatchAlt: image?.altText } : {}),
      publishTargets: [env.PUBLISH_TARGET_NAME],
      reviewScore: review.total,
      reviewComments: review.comments.join("\n"),
    },
    status
  );

  if (draft.topic.keywordRecordId) {
    await microcms.markKeywordUsed(draft.topic.keywordRecordId, articleId);
  }

  return articleId;
}
