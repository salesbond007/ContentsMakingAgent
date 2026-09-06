import fs from "node:fs";
import path from "node:path";
import { logger } from "../lib/logger.js";

export interface CtaOption {
  id: string;
  label: string;
  url: string;
  buttonText: string;
  useWhen: string;
}

/**
 * config/ctas.json（またはCTA_CONFIG_PATHで指定したファイル）に事前登録されたCTA一覧を読み込む。
 * URLのでっち上げ（ハルシネーション）を防ぐため、AIには自由にCTAを作らせず、
 * ここに登録された実在のCTAの中から選ばせる方式にしている。
 * ファイルが存在しない・不正な場合は空配列を返し、CTAなしで記事を生成する。
 */
export function loadCtas(customPath?: string): CtaOption[] {
  const filePath = path.resolve(process.cwd(), customPath ?? "config/ctas.json");

  if (!fs.existsSync(filePath)) {
    logger.info("ctas.jsonが見つからないためCTAなしで続行します", { filePath });
    return [];
  }

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return Array.isArray(raw.ctas) ? raw.ctas : [];
  } catch (err) {
    logger.warn("ctas.jsonの読み込みに失敗したためCTAなしで続行します", {
      filePath,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
