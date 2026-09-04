import type { Env } from "../config.js";
import type { ArticleDraft, GeneratedImage, KeywordRecord, ReviewResult } from "../types.js";
import { loadFieldMaps, type FieldMaps } from "./microcmsFields.js";

interface MicroCmsListResponse<T> {
  contents: T[];
  totalCount: number;
  offset: number;
  limit: number;
}

export class MicroCmsClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fields: FieldMaps;

  constructor(private readonly env: Env) {
    this.baseUrl = `https://${env.MICROCMS_SERVICE_DOMAIN}.microcms.io/api/v1`;
    this.apiKey = env.MICROCMS_API_KEY;
    this.fields = loadFieldMaps(env.MICROCMS_FIELD_MAP_PATH);
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "X-MICROCMS-API-KEY": this.apiKey,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`microCMS API error ${res.status} ${path}: ${body}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  /** 未使用キーワード（usedAtフィールドが存在しないもの）を取得する。 */
  async getUnusedKeywords(limit: number): Promise<KeywordRecord[]> {
    const kw = this.fields.keywords;
    const query = new URLSearchParams({
      filters: `${kw.usedAt}[not_exists]`,
      limit: String(limit),
    });
    const res = await this.request<MicroCmsListResponse<Record<string, unknown>>>(
      `/${this.env.MICROCMS_KEYWORDS_ENDPOINT}?${query.toString()}`
    );
    return res.contents.map((c) => ({
      id: c.id as string,
      keyword: c[kw.keyword] as string,
      usedAt: c[kw.usedAt] as string | undefined,
      articleId: c[kw.articleId] as string | undefined,
      sourceUrls: (c[kw.sourceUrls] as string[] | undefined) ?? [],
    }));
  }

  /** 直近の公開記事タイトルを取得する。査読エージェントの「剽窃・重複」判定で自社記事との重複チェックに使う。 */
  async getRecentArticleTitles(limit = 50): Promise<string[]> {
    const art = this.fields.articles;
    const query = new URLSearchParams({
      fields: art.title,
      limit: String(limit),
      orders: "-publishedAt", // publishedAtはmicroCMSの標準フィールドのため対応表の対象外
    });
    const res = await this.request<MicroCmsListResponse<Record<string, unknown>>>(
      `/${this.env.MICROCMS_ARTICLES_ENDPOINT}?${query.toString()}`
    );
    return res.contents.map((c) => c[art.title] as string).filter(Boolean);
  }

  /** 探索で見つけた新規キーワードを台帳に追加する（重複防止のため次回以降の巡回対象になる）。 */
  async registerKeyword(keyword: string, sourceUrls: string[]): Promise<string> {
    const kw = this.fields.keywords;
    const res = await this.request<{ id: string }>(`/${this.env.MICROCMS_KEYWORDS_ENDPOINT}`, {
      method: "POST",
      body: JSON.stringify({ [kw.keyword]: keyword, [kw.sourceUrls]: sourceUrls }),
    });
    return res.id;
  }

  /** キーワードを使用済みにマークし、生成された記事IDと紐づける。 */
  async markKeywordUsed(keywordId: string, articleId: string): Promise<void> {
    const kw = this.fields.keywords;
    await this.request(`/${this.env.MICROCMS_KEYWORDS_ENDPOINT}/${keywordId}`, {
      method: "PATCH",
      body: JSON.stringify({ [kw.usedAt]: new Date().toISOString(), [kw.articleId]: articleId }),
    });
  }

  /** 画像をmicroCMSのメディアライブラリにアップロードし、公開URLを取得する。 */
  async uploadMedia(buffer: Buffer, fileName: string, mimeType: string): Promise<{ url: string }> {
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: mimeType }), fileName);
    const res = await fetch(`https://${this.env.MICROCMS_SERVICE_DOMAIN}.microcms-management.io/api/v1/media`, {
      method: "POST",
      headers: { "X-MICROCMS-API-KEY": this.apiKey },
      body: form,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`microCMS media upload error ${res.status}: ${body}`);
    }
    return (await res.json()) as { url: string };
  }

  /**
   * 記事下書き／記事一式をmicroCMSのフィールドIDにマッピングして作成する。
   * status: "publish" は即時公開、"draft" は下書き保存。
   * microCMSの契約プラン・API設定によりクエリパラメータの仕様が異なる場合があるため、
   * 導入時にmicroCMS側の下書き保存APIの挙動を確認のうえ調整すること。
   * フィールドIDの対応表は config/microcms-fields.json を参照・編集する。
   */
  async createArticleFromDraft(
    draft: ArticleDraft,
    review: ReviewResult,
    publishTargetName: string,
    status: "publish" | "draft",
    eyecatch?: { url: string; alt: string }
  ): Promise<string> {
    const art = this.fields.articles;
    const content: Record<string, unknown> = {
      [art.title]: draft.title,
      [art.excerpt]: draft.excerpt,
      [art.body]: draft.body,
      [art.category]: draft.category,
      [art.tags]: draft.tags,
      [art.seo]: {
        [art.seoMetaTitle]: draft.seo.metaTitle,
        [art.seoMetaDescription]: draft.seo.metaDescription,
      },
      [art.publishTargets]: [publishTargetName],
      [art.reviewScore]: review.total,
      [art.reviewComments]: review.comments.join("\n"),
    };

    if (eyecatch) {
      content[art.eyecatch] = { url: eyecatch.url };
      content[art.eyecatchAlt] = eyecatch.alt;
    }

    const query = status === "draft" ? "?status=draft" : "";
    const res = await this.request<{ id: string }>(`/${this.env.MICROCMS_ARTICLES_ENDPOINT}${query}`, {
      method: "POST",
      body: JSON.stringify(content),
    });
    return res.id;
  }
}
