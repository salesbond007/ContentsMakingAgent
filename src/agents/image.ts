import type OpenAI from "openai";
import { generateEyecatch } from "../clients/openaiImage.js";
import type { ArticleDraft, GeneratedImage } from "../types.js";
import { logger } from "../lib/logger.js";

/**
 * 画像生成エージェント。失敗しても記事全体は止めず、画像なし（undefined）を返す。
 * 呼び出し元で下書き保存＋要確認リストへの追加を行うこと。
 */
export async function generateArticleImage(
  openai: OpenAI,
  draft: ArticleDraft
): Promise<GeneratedImage | undefined> {
  try {
    const { buffer, mimeType } = await generateEyecatch(openai, {
      title: draft.title,
      excerpt: draft.excerpt,
    });
    return { buffer, mimeType, altText: draft.title };
  } catch (err) {
    logger.error("アイキャッチ画像の生成に失敗しました。画像なしで続行します。", {
      title: draft.title,
      error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}
