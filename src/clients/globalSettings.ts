import fs from "node:fs";
import path from "node:path";
import { logger } from "../lib/logger.js";

export interface GlobalSettings {
  /**
   * すべての記事生成(自動・手動を問わない)が絶対に違反してはならないルール(自由記述、複数行可)。
   * 例: 「製造業のAI初心者向け」と設定した場合、この前提から絶対にずれてはいけない。
   * ライティングエージェントには最優先の絶対ルールとして、査読エージェントには違反チェック項目として渡す。
   */
  mustNotViolate: string;
}

const DEFAULT: GlobalSettings = { mustNotViolate: "" };

/**
 * config/global-settings.json（またはGLOBAL_SETTINGS_PATHで指定したファイル）を読み込む。
 * ファイルが存在しない・不正な場合はデフォルト(制約なし)で続行する。
 */
export function loadGlobalSettings(customPath?: string): GlobalSettings {
  const filePath = path.resolve(process.cwd(), customPath ?? "config/global-settings.json");

  if (!fs.existsSync(filePath)) {
    logger.info("global-settings.jsonが見つからないため全体設定なしで続行します", { filePath });
    return DEFAULT;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return { ...DEFAULT, ...raw };
  } catch (err) {
    logger.warn("global-settings.jsonの読み込みに失敗したため全体設定なしで続行します", {
      filePath,
      error: err instanceof Error ? err.message : String(err),
    });
    return DEFAULT;
  }
}
