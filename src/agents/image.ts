import type OpenAI from "openai";
import { generateDiagram, generateEyecatch } from "../clients/openaiImage.js";
import { renderBarChartSvg } from "../lib/chartSvg.js";
import { truncateAltText } from "../lib/seoFile.js";
import type { ThumbnailStyle } from "../clients/thumbnailStyle.js";
import type { ArticleDraft, GeneratedImage, RenderedFigure } from "../types.js";
import { logger } from "../lib/logger.js";

/**
 * 画像生成エージェント。失敗しても記事全体は止めず、画像なし（undefined）を返す。
 * 呼び出し元で下書き保存＋要確認リストへの追加を行うこと。
 * thumbnailStyle.referenceImageUrlが設定されている場合、そのデザインに寄せて生成する。
 */
export async function generateArticleImage(
  openai: OpenAI,
  draft: ArticleDraft,
  thumbnailStyle?: ThumbnailStyle
): Promise<GeneratedImage | undefined> {
  try {
    const { buffer, mimeType } = await generateEyecatch(
      openai,
      { title: draft.title, excerpt: draft.excerpt },
      thumbnailStyle?.referenceImageUrl
        ? { url: thumbnailStyle.referenceImageUrl, note: thumbnailStyle.note }
        : undefined
    );
    return { buffer, mimeType, altText: truncateAltText(draft.title) };
  } catch (err) {
    logger.error("アイキャッチ画像の生成に失敗しました。画像なしで続行します。", {
      title: draft.title,
      error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

/**
 * 本文中に挿入する図解(グラフ・概念図)を生成する。1件の生成に失敗しても他の図解の生成は続ける。
 * 失敗した図解は結果に含まれず、公開エージェント側で本文中のプレースホルダーを除去する。
 * - chart: 実データをもとにコード側で正確なSVGを描画（AI画像生成は使わない）
 * - diagram: gpt-image-1で文字無しの概念図を生成
 */
export async function generateFigures(openai: OpenAI, draft: ArticleDraft): Promise<RenderedFigure[]> {
  const figures: RenderedFigure[] = [];

  for (const spec of draft.figures) {
    try {
      if (spec.type === "chart" && spec.chart) {
        const svg = renderBarChartSvg(spec.chart, spec.caption);
        figures.push({
          token: spec.token,
          buffer: Buffer.from(svg, "utf-8"),
          mimeType: "image/svg+xml",
          altText: truncateAltText(spec.caption),
        });
      } else if (spec.type === "diagram" && spec.diagramPrompt) {
        const { buffer, mimeType } = await generateDiagram(openai, {
          caption: spec.caption,
          diagramPrompt: spec.diagramPrompt,
        });
        figures.push({ token: spec.token, buffer, mimeType, altText: truncateAltText(spec.caption) });
      }
    } catch (err) {
      logger.error("図解の生成に失敗しました。この図解なしで続行します。", {
        title: draft.title,
        token: spec.token,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return figures;
}
