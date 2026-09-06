// 数値解析画面用の最小限のmicroCMS読み取りクライアント。パイプライン本体(src/clients/microcms.ts)とは
// 独立して持つ(管理画面はNext.jsのEdge/Node混在環境で動くため、依存を増やしたくない)。
// microCMSの公開APIキーは公開済み(publish)コンテンツしか返さないため、下書きは自動的に除外される。

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} が設定されていません`);
  return value;
}

interface MicroCmsListResponse {
  contents: { publishedAt: string }[];
  totalCount: number;
}

/**
 * 公開記事のpublishedAtを新しい順に取得する(最大limit件、100件ずつページング)。
 * totalCountはmicroCMS上の公開記事の総数(dates自体はlimitで打ち切られる場合がある)。
 */
export async function getPublishedAtDates(limit = 500): Promise<{ dates: string[]; totalCount: number }> {
  const domain = env("MICROCMS_SERVICE_DOMAIN");
  const apiKey = env("MICROCMS_API_KEY");
  const endpoint = process.env.MICROCMS_ARTICLES_ENDPOINT ?? "articles";
  const baseUrl = `https://${domain}.microcms.io/api/v1/${endpoint}`;

  const dates: string[] = [];
  let offset = 0;
  let totalCount = 0;
  const pageSize = 100;

  while (dates.length < limit) {
    const query = new URLSearchParams({
      fields: "publishedAt",
      orders: "-publishedAt",
      limit: String(Math.min(pageSize, limit - dates.length)),
      offset: String(offset),
    });
    const res = await fetch(`${baseUrl}?${query.toString()}`, {
      headers: { "X-MICROCMS-API-KEY": apiKey },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`microCMS API error ${res.status}: ${await res.text()}`);

    const json = (await res.json()) as MicroCmsListResponse;
    totalCount = json.totalCount;
    dates.push(...json.contents.map((c) => c.publishedAt).filter(Boolean));

    offset += pageSize;
    if (offset >= json.totalCount || json.contents.length === 0) break;
  }

  return { dates, totalCount };
}
