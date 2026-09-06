import fs from "node:fs";
import path from "node:path";

const DEFAULT_PATH = "data/pending-notifications.json";

interface PendingNotificationsFile {
  pending: string[];
}

function resolvePath(customPath?: string): string {
  return path.resolve(process.cwd(), customPath ?? DEFAULT_PATH);
}

function readFile(filePath: string): PendingNotificationsFile {
  if (!fs.existsSync(filePath)) return { pending: [] };
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return { pending: Array.isArray(raw.pending) ? raw.pending : [] };
  } catch {
    return { pending: [] };
  }
}

function writeFile(filePath: string, data: PendingNotificationsFile): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

/**
 * 毎日の自動実行(スケジュール実行)の結果をSlackへ即時通知せず、後で21時にまとめて送るため
 * ファイルに蓄積しておく。このファイル自体はワークフロー側でコミット・pushして永続化する。
 */
export function appendPendingNotification(message: string, customPath?: string): void {
  const filePath = resolvePath(customPath);
  const current = readFile(filePath);
  current.pending.push(message);
  writeFile(filePath, current);
}

/** 蓄積された通知をすべて読み出し、ファイルを空にする（21時の通知ワークフローから呼ぶ）。 */
export function readAndClearPendingNotifications(customPath?: string): string[] {
  const filePath = resolvePath(customPath);
  const current = readFile(filePath);
  writeFile(filePath, { pending: [] });
  return current.pending;
}
