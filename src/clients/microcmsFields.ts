import fs from "node:fs";
import path from "node:path";
import { logger } from "../lib/logger.js";

export interface ArticleFieldMap {
  title: string;
  excerpt: string;
  body: string;
  category: string;
  tags: string;
  seoMetaTitle: string;
  seoMetaDescription: string;
  eyecatch: string;
  eyecatchAlt: string;
  publishTargets: string;
  reviewScore: string;
  reviewComments: string;
}

export interface KeywordFieldMap {
  keyword: string;
  sourceUrls: string;
  usedAt: string;
  articleId: string;
}

export interface FieldMaps {
  articles: ArticleFieldMap;
  keywords: KeywordFieldMap;
}

const DEFAULT_FIELD_MAPS: FieldMaps = {
  articles: {
    title: "title",
    excerpt: "excerpt",
    body: "body",
    category: "category",
    tags: "tags",
    seoMetaTitle: "seoMetaTitle",
    seoMetaDescription: "seoMetaDescription",
    eyecatch: "eyecatch",
    eyecatchAlt: "eyecatchAlt",
    publishTargets: "publishTargets",
    reviewScore: "reviewScore",
    reviewComments: "reviewComments",
  },
  keywords: {
    keyword: "keyword",
    sourceUrls: "sourceUrls",
    usedAt: "usedAt",
    articleId: "articleId",
  },
};

/**
 * microCMS側のフィールドID対応表を読み込む。
 * config/microcms-fields.json（またはMICROCMS_FIELD_MAP_PATHで指定したファイル）を編集するだけで、
 * microCMSのフィールドIDが変わってもTypeScriptのコードを一切変更せずに追従できる。
 * ファイルが存在しない・一部のキーしか書かれていない場合はデフォルト値で補完する。
 */
export function loadFieldMaps(customPath?: string): FieldMaps {
  const filePath = path.resolve(process.cwd(), customPath ?? "config/microcms-fields.json");

  if (!fs.existsSync(filePath)) {
    logger.info("microcms-fields.jsonが見つからないためデフォルトのフィールド名を使用します", { filePath });
    return DEFAULT_FIELD_MAPS;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return {
      articles: { ...DEFAULT_FIELD_MAPS.articles, ...raw.articles },
      keywords: { ...DEFAULT_FIELD_MAPS.keywords, ...raw.keywords },
    };
  } catch (err) {
    logger.warn("microcms-fields.jsonの読み込みに失敗したためデフォルトのフィールド名を使用します", {
      filePath,
      error: err instanceof Error ? err.message : String(err),
    });
    return DEFAULT_FIELD_MAPS;
  }
}
