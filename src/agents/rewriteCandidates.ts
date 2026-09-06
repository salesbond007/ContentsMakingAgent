import type { MicroCmsClient } from "../clients/microcms.js";

export interface RewriteCandidate {
  id: string;
  title: string;
  publishedAt: string;
  daysSincePublished: number;
}

/**
 * 公開から一定期間(thresholdDays)以上経過した記事をリライト候補としてリストアップする。
 * あくまで「提案」に留め、自動でのリライト・再公開は行わない（内容の陳腐化は人が最終判断すべきため）。
 */
export async function findRewriteCandidates(
  microcms: MicroCmsClient,
  thresholdDays: number,
  limit = 100
): Promise<RewriteCandidate[]> {
  const articles = await microcms.getArticlesForRewriteCheck(limit);
  const now = Date.now();

  return articles
    .map((a) => {
      const publishedAtMs = new Date(a.publishedAt).getTime();
      const daysSincePublished = Math.floor((now - publishedAtMs) / (24 * 60 * 60 * 1000));
      return { ...a, daysSincePublished };
    })
    .filter((a) => a.daysSincePublished >= thresholdDays)
    .sort((a, b) => b.daysSincePublished - a.daysSincePublished);
}
