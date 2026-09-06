import fs from "node:fs";
import path from "node:path";
import { logger } from "../lib/logger.js";

export type ImageUseCase = "chart" | "seminar" | "thumbnail";

export interface ImageEntry {
  id: string;
  title: string;
  /** 画像そのもののURL、またはGoogleドライブ等の格納先へのリンク。 */
  url: string;
  useCase: ImageUseCase;
  note?: string;
}

/**
 * config/images.json（またはIMAGE_LIBRARY_PATHで指定したファイル）に登録された画像素材の一覧を読み込む。
 * 「グラフ」「セミナー誘致」「通常記事のサムネ」等、用途別に画像を管理できる。
 * ファイルが存在しない・不正な場合は空配列を返す。
 */
export function loadImageLibrary(customPath?: string): ImageEntry[] {
  const filePath = path.resolve(process.cwd(), customPath ?? "config/images.json");

  if (!fs.existsSync(filePath)) {
    logger.info("images.jsonが見つからないため画像素材なしで続行します", { filePath });
    return [];
  }

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return Array.isArray(raw.images) ? raw.images : [];
  } catch (err) {
    logger.warn("images.jsonの読み込みに失敗したため画像素材なしで続行します", {
      filePath,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * アイキャッチ(通常記事のサムネ用途)の参考画像を1件選ぶ。複数登録されている場合は先頭のものを使う。
 * 参考画像URLが直接取得できない(Googleドライブの共有リンク等)場合は、呼び出し側で取得失敗時に
 * 通常生成へフォールバックする前提のため、ここではURLの形式チェックは行わない。
 */
export function getThumbnailReference(images: ImageEntry[]): { url: string; note?: string } | undefined {
  const found = images.find((i) => i.useCase === "thumbnail");
  return found ? { url: found.url, note: found.note } : undefined;
}
