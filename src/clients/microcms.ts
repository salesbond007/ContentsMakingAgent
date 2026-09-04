import type { Env } from "../config.js";
import type { KeywordRecord } from "../types.js";

interface MicroCmsListResponse<T> {
  contents: T[];
  totalCount: number;
  offset: number;
  limit: number;
}

export class MicroCmsClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private readonly env: Env) {
    this.baseUrl = `https://${env.MICROCMS_SERVICE_DOMAIN}.microcms.io/api/v1`;
    this.apiKey = env.MICROCMS_API_KEY;
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

  /** 未使用キーワード（usedAt が存在しないもの）を取得する。 */
  async getUnusedKeywords(limit: number): Promise<KeywordRecord[]> {
    const query = new URLSearchParams({
      filters: "usedAt[not_exists]",
      limit: String(limit),
    });
    const res = await this.request<MicroCmsListResponse<any>>(
      `/${this.env.MICROCMS_KEYWORDS_ENDPOINT}?${query.toString()}`
    );
    return res.contents.map((c) => ({
      id: c.id,
      keyword: c.keyword,
      usedAt: c.usedAt,
      articleId: c.articleId,
      sourceUrls: c.sourceUrls ?? [],
    }));
  }

  /** 探索で見つけた新規キーワードを台帳に追加する（重複防止のため次回以降の巡回対象になる）。 */
  async registerKeyword(keyword: string, sourceUrls: string[]): Promise<string> {
    const res = await this.request<{ id: string }>(`/${this.env.MICROCMS_KEYWORDS_ENDPOINT}`, {
      method: "POST",
      body: JSON.stringify({ keyword, sourceUrls }),
    });
    return res.id;
  }

  /** キーワードを使用済みにマークし、生成された記事IDと紐づける。 */
  async markKeywordUsed(keywordId: string, articleId: string): Promise<void> {
    await this.request(`/${this.env.MICROCMS_KEYWORDS_ENDPOINT}/${keywordId}`, {
      method: "PATCH",
      body: JSON.stringify({ usedAt: new Date().toISOString(), articleId }),
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
   * 記事を作成する。status: "publish" は即時公開、"draft" は下書き保存。
   * microCMSの契約プラン・API設定によりクエリパラメータの仕様が異なる場合があるため、
   * 導入時にmicroCMS側の下書き保存APIの挙動を確認のうえ調整すること。
   */
  async createArticle(content: Record<string, unknown>, status: "publish" | "draft"): Promise<string> {
    const query = status === "draft" ? "?status=draft" : "";
    const res = await this.request<{ id: string }>(
      `/${this.env.MICROCMS_ARTICLES_ENDPOINT}${query}`,
      {
        method: "POST",
        body: JSON.stringify(content),
      }
    );
    return res.id;
  }
}
