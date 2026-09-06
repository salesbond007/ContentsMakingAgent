import fs from "node:fs";
import path from "node:path";
import { logger } from "../lib/logger.js";

export interface DailyStatsEntry {
  date: string; // YYYY-MM-DD
  published: number;
  needsReview: number;
  rejected: number;
  errors: number;
}

interface DailyStatsFile {
  entries: DailyStatsEntry[];
}

const MAX_ENTRIES = 90;

function resolvePath(customPath?: string): string {
  return path.resolve(process.cwd(), customPath ?? "data/daily-stats.json");
}

function readFile(filePath: string): DailyStatsFile {
  if (!fs.existsSync(filePath)) return { entries: [] };
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return { entries: Array.isArray(raw.entries) ? raw.entries : [] };
  } catch (err) {
    logger.warn("daily-stats.jsonの読み込みに失敗したため空の状態から続行します", {
      filePath,
      error: err instanceof Error ? err.message : String(err),
    });
    return { entries: [] };
  }
}

/** 1回のパイプライン実行結果を日次統計に加算する。同日に複数回実行された場合は加算する。 */
export function appendDailyStats(entry: DailyStatsEntry, customPath?: string): void {
  const filePath = resolvePath(customPath);
  const file = readFile(filePath);

  const existing = file.entries.find((e) => e.date === entry.date);
  if (existing) {
    existing.published += entry.published;
    existing.needsReview += entry.needsReview;
    existing.rejected += entry.rejected;
    existing.errors += entry.errors;
  } else {
    file.entries.push(entry);
  }

  file.entries = file.entries.slice(-MAX_ENTRIES);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(file, null, 2) + "\n", "utf-8");
}

/** 直近N日分の統計を読み出す。 */
export function readRecentDailyStats(days: number, customPath?: string): DailyStatsEntry[] {
  const filePath = resolvePath(customPath);
  const file = readFile(filePath);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return file.entries.filter((e) => new Date(`${e.date}T00:00:00Z`).getTime() >= cutoff);
}
