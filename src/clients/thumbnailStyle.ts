import fs from "node:fs";
import path from "node:path";
import { logger } from "../lib/logger.js";

export interface ThumbnailStyle {
  /** アイキャッチ画像生成時にデザインの参考にする画像URL(任意)。空文字なら参考画像なしで生成する。 */
  referenceImageUrl: string;
  /** 参考画像のどの部分を踏襲してほしいかの補足メモ(任意)。 */
  note: string;
}

const DEFAULT: ThumbnailStyle = { referenceImageUrl: "", note: "" };

/**
 * config/thumbnail-style.json（またはTHUMBNAIL_STYLE_PATHで指定したファイル）を読み込む。
 * 管理画面「サムネイル」ページから編集できる。参考画像を登録しておくと、
 * アイキャッチ画像生成時にgpt-image-1の画像編集APIでそのデザインに寄せて生成する。
 */
export function loadThumbnailStyle(customPath?: string): ThumbnailStyle {
  const filePath = path.resolve(process.cwd(), customPath ?? "config/thumbnail-style.json");

  if (!fs.existsSync(filePath)) {
    logger.info("thumbnail-style.jsonが見つからないため参考画像なしで続行します", { filePath });
    return DEFAULT;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return { ...DEFAULT, ...raw };
  } catch (err) {
    logger.warn("thumbnail-style.jsonの読み込みに失敗したため参考画像なしで続行します", {
      filePath,
      error: err instanceof Error ? err.message : String(err),
    });
    return DEFAULT;
  }
}
