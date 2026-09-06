import fs from "node:fs";
import path from "node:path";
import { logger } from "../lib/logger.js";

/**
 * config/ng-words.json（またはNG_WORDS_PATHで指定したファイル）に登録されたNGワード・
 * 言い回しの一覧を読み込む。薬機法・景表法的にグレーな断定表現や、自社として避けたい表現を
 * 人間が随時追加・削除できるようにする（コード変更不要）。
 * ファイルが存在しない・不正な場合は空配列を返し、NGワードチェックなしで続行する。
 */
export function loadNgWords(customPath?: string): string[] {
  const filePath = path.resolve(process.cwd(), customPath ?? "config/ng-words.json");

  if (!fs.existsSync(filePath)) {
    logger.info("ng-words.jsonが見つからないためNGワードチェックなしで続行します", { filePath });
    return [];
  }

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return Array.isArray(raw.words) ? raw.words.filter((w: unknown) => typeof w === "string" && w.trim()) : [];
  } catch (err) {
    logger.warn("ng-words.jsonの読み込みに失敗したためNGワードチェックなしで続行します", {
      filePath,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/** 本文中に含まれるNGワードを検出する（機械的な部分一致チェック）。 */
export function findNgWordHits(body: string, ngWords: string[]): string[] {
  const plainText = body.replace(/<[^>]+>/g, "");
  return ngWords.filter((word) => plainText.includes(word));
}
