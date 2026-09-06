import fs from "node:fs";
import path from "node:path";
import { logger } from "../lib/logger.js";

/**
 * - style: 文体・構成の参考記事。内容は一切転載・流用せず、構造とトーンだけを参考にする。
 * - service: 自社サービスに関する正確な情報源(LP・資料・メモ)。CTAや本文で自社サービスに触れる際、
 *   ここに書かれた情報だけを正しい情報源として使ってよい(でっち上げ防止)。
 */
export type ReferenceMaterialType = "style" | "service";

export interface ReferenceMaterial {
  id: string;
  type: ReferenceMaterialType;
  label: string;
  /** LPが複数ある場合や資料を複数貼りたい場合を想定し、複数登録できる。 */
  urls: string[];
  /** URLを開かなくても分かるよう、直接貼り付けた情報・補足メモ。 */
  memo: string;
}

/**
 * config/reference-materials.json（またはREFERENCE_MATERIALS_PATHで指定したファイル）を読み込む。
 * ファイルが存在しない・不正な場合は空配列を返し、参考資料なしで生成を続ける。
 */
export function loadReferenceMaterials(customPath?: string): ReferenceMaterial[] {
  const filePath = path.resolve(process.cwd(), customPath ?? "config/reference-materials.json");

  if (!fs.existsSync(filePath)) {
    logger.info("reference-materials.jsonが見つからないため参考資料なしで続行します", { filePath });
    return [];
  }

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return Array.isArray(raw.materials) ? raw.materials : [];
  } catch (err) {
    logger.warn("reference-materials.jsonの読み込みに失敗したため参考資料なしで続行します", {
      filePath,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
