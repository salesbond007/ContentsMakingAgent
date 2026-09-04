import { logger } from "./logger.js";

/**
 * 要件定義書 07-運用「リトライ」: LLM呼び出しの一時的エラーは1回だけリトライする。
 * 2回失敗した場合は呼び出し元でその記事をスキップする。
 */
export async function withOneRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    logger.warn(`${label} が失敗したため1回リトライします`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return await fn();
  }
}
