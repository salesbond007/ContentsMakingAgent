import fs from "node:fs";
import path from "node:path";
import { logger } from "../lib/logger.js";

export interface SiteConfig {
  /**
   * 記事詳細ページのURLパターン。"{id}"をmicroCMSのコンテンツIDに置換して使う
   * (例: "https://media.bondai.example.com/articles/{id}")。
   * 空文字の場合は内部リンクのURLを確定できないため、内部リンク機能は無効化される
   * (サイト側のURL設計が固まるまでは安全側に倒し、誤ったリンクを本文に入れない)。
   */
  articleUrlPattern: string;
}

const DEFAULT: SiteConfig = { articleUrlPattern: "" };

/**
 * config/site.json（またはSITE_CONFIG_PATHで指定したファイル）を読み込む。
 * ファイルが存在しない・不正な場合はデフォルト(空)で続行する。
 */
export function loadSiteConfig(customPath?: string): SiteConfig {
  const filePath = path.resolve(process.cwd(), customPath ?? "config/site.json");

  if (!fs.existsSync(filePath)) {
    logger.info("site.jsonが見つからないため内部リンク機能なしで続行します", { filePath });
    return DEFAULT;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return { ...DEFAULT, ...raw };
  } catch (err) {
    logger.warn("site.jsonの読み込みに失敗したため内部リンク機能なしで続行します", {
      filePath,
      error: err instanceof Error ? err.message : String(err),
    });
    return DEFAULT;
  }
}

export function buildArticleUrl(pattern: string, articleId: string): string {
  return pattern.replace("{id}", articleId);
}
