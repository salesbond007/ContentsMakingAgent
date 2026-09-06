import fs from "node:fs";
import path from "node:path";
import { logger } from "../lib/logger.js";
import type { Topic } from "../types.js";

/**
 * API残高不足等で自動実行が中断された際、「まだ手を付けていないお題」を一時保存しておく。
 * 次回の自動実行で残っている分から再開し、当初予定していた本数分を仕上げる。
 */
export interface ResumeState {
  /** 中断した日付(YYYY-MM-DD)。参考情報として保持するのみで、再開判定には使わない。 */
  interruptedOn: string;
  /** その日すでに正常完了した件数(Slack通知等の表示用)。 */
  completedCount: number;
  /** まだ着手していないお題の一覧。次回実行時にここから再開する。 */
  remainingTopics: Topic[];
}

function resolvePath(customPath?: string): string {
  return path.resolve(process.cwd(), customPath ?? "data/resume-state.json");
}

/** 中断状態を読み込む。無ければnull。 */
export function loadResumeState(customPath?: string): ResumeState | null {
  const filePath = resolvePath(customPath);
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (!Array.isArray(raw.remainingTopics) || raw.remainingTopics.length === 0) return null;
    return raw as ResumeState;
  } catch (err) {
    logger.warn("resume-state.jsonの読み込みに失敗したため再開情報なしで続行します", {
      filePath,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** 中断状態を保存する(残っているお題があるとき)。 */
export function saveResumeState(state: ResumeState, customPath?: string): void {
  const filePath = resolvePath(customPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2) + "\n", "utf-8");
}

/**
 * 中断状態を消去する(残っているお題を最後まで処理し終えたとき)。
 * ファイル自体は削除せず空オブジェクトで上書きする(gitで常に追跡対象にしておき、
 * CI側のコミット処理でパス不在エラーが起きないようにするため)。
 */
export function clearResumeState(customPath?: string): void {
  const filePath = resolvePath(customPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, "{}\n", "utf-8");
}
