import fs from "node:fs";
import path from "node:path";
import { logger } from "../lib/logger.js";
import type { ReviewQueueItem } from "../types.js";

interface ReviewQueueFile {
  items: ReviewQueueItem[];
}

function resolvePath(customPath?: string): string {
  return path.resolve(process.cwd(), customPath ?? "data/manual-review-queue.json");
}

function readFile(filePath: string): ReviewQueueFile {
  if (!fs.existsSync(filePath)) return { items: [] };
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return { items: Array.isArray(raw.items) ? raw.items : [] };
  } catch (err) {
    logger.warn("manual-review-queue.jsonの読み込みに失敗したため空の状態から続行します", {
      filePath,
      error: err instanceof Error ? err.message : String(err),
    });
    return { items: [] };
  }
}

function writeFile(filePath: string, data: ReviewQueueFile): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

/** 手動生成で査読まで完了した記事を、人間の確認待ちキューに追加する。 */
export function appendReviewQueueItem(item: ReviewQueueItem, customPath?: string): void {
  const filePath = resolvePath(customPath);
  const file = readFile(filePath);
  file.items.push(item);
  writeFile(filePath, file);
}

/** idを指定してキューから1件取得する。 */
export function findReviewQueueItem(id: string, customPath?: string): ReviewQueueItem | undefined {
  const filePath = resolvePath(customPath);
  return readFile(filePath).items.find((i) => i.id === id);
}

/** idを指定してキューから1件削除する(承認してCMSに反映した後に呼ぶ)。 */
export function removeReviewQueueItem(id: string, customPath?: string): void {
  const filePath = resolvePath(customPath);
  const file = readFile(filePath);
  file.items = file.items.filter((i) => i.id !== id);
  writeFile(filePath, file);
}
