import fs from "node:fs";
import path from "node:path";
import { logger } from "../lib/logger.js";

export interface StyleReference {
  label: string;
  url: string;
  note: string;
}

/**
 * config/style-references.json（またはSTYLE_REFERENCES_PATHで指定したファイル）に登録された
 * 参考記事の一覧を読み込む。ライティングエージェントはこれらを実際にweb_fetchで取得し、
 * 文体・構成のお手本として参照する（内容の転載はしない）。
 * ファイルが存在しない・不正な場合は空配列を返し、参考記事なしで生成を続ける。
 */
export function loadStyleReferences(customPath?: string): StyleReference[] {
  const filePath = path.resolve(process.cwd(), customPath ?? "config/style-references.json");

  if (!fs.existsSync(filePath)) {
    logger.info("style-references.jsonが見つからないため参考記事なしで続行します", { filePath });
    return [];
  }

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return Array.isArray(raw.references) ? raw.references : [];
  } catch (err) {
    logger.warn("style-references.jsonの読み込みに失敗したため参考記事なしで続行します", {
      filePath,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
