import OpenAI, { toFile } from "openai";
import type { Env } from "../config.js";
import { logger } from "../lib/logger.js";

export function createOpenAiClient(env: Env): OpenAI {
  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
}

/** BondAIメディアのブランドカラー（ワインレッド）を意識した固定スタイルプロンプト。 */
export const BRAND_STYLE_PROMPT =
  "モダンでプロフェッショナルなBtoBメディア向けアイキャッチ画像。" +
  "ブランドカラーはワインレッド(#7B1F2B前後)をアクセントとして使用し、清潔感のあるフラットデザイン。" +
  "誇張した表現や過度に煽情的な要素は避け、信頼感のあるトーンで仕上げる。文字は入れない。";

export async function generateEyecatch(
  client: OpenAI,
  opts: { title: string; excerpt: string },
  referenceImage?: { url: string; note?: string }
): Promise<{ buffer: Buffer; mimeType: string }> {
  const prompt = `${BRAND_STYLE_PROMPT}\n\n記事タイトル: ${opts.title}\n記事の要約: ${opts.excerpt}`;

  if (referenceImage?.url) {
    try {
      return await generateEyecatchFromReference(client, prompt, referenceImage);
    } catch (err) {
      logger.warn("参考画像を使ったアイキャッチ生成に失敗したため、通常生成にフォールバックします", {
        referenceImageUrl: referenceImage.url,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const result = await client.images.generate({
    model: "gpt-image-1",
    prompt,
    size: "1536x1024",
    n: 1,
  });

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("gpt-image-1から画像データを取得できませんでした");
  }
  return { buffer: Buffer.from(b64, "base64"), mimeType: "image/png" };
}

/**
 * 管理画面で登録された参考画像をもとに、gpt-image-1の画像編集APIでデザインを踏襲した
 * アイキャッチ画像を生成する。参考画像の取得や編集APIが失敗した場合は呼び出し元でフォールバックする。
 */
async function generateEyecatchFromReference(
  client: OpenAI,
  basePrompt: string,
  referenceImage: { url: string; note?: string }
): Promise<{ buffer: Buffer; mimeType: string }> {
  const res = await fetch(referenceImage.url);
  if (!res.ok) throw new Error(`参考画像の取得に失敗しました: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "image/png";
  const file = await toFile(buffer, "reference.png", { type: contentType });

  const prompt =
    `${basePrompt}\n\n` +
    "参考画像として渡す既存のアイキャッチデザインは、あくまで雰囲気を掴むための参考程度に留めてください。" +
    "配色・構図のトーンは緩やかに踏襲しつつも、記事の内容やテーマに応じて構図・要素・雰囲気を柔軟に" +
    "変えて構いません（この参考画像に厳密に一致させる必要はありません）。この記事の内容に最も合う" +
    "デザインを優先して新しく描き直してください。" +
    (referenceImage.note ? `\n参考画像についての補足: ${referenceImage.note}` : "");

  const result = await client.images.edit({
    model: "gpt-image-1",
    image: file,
    prompt,
    size: "1536x1024",
    n: 1,
  });

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("gpt-image-1(画像編集)から画像データを取得できませんでした");
  }
  return { buffer: Buffer.from(b64, "base64"), mimeType: "image/png" };
}

/**
 * 本文中に挿入する概念図・イメージ図を生成する。データやグラフはAI画像生成では正確に描けないため
 * ここでは扱わない（数値を伴う図は src/lib/chartSvg.ts で正確に描画する）。
 * 文字・数字・ラベルを画像内に含めないよう強く指示し、誤情報混入のリスクを避ける。
 */
export async function generateDiagram(
  client: OpenAI,
  opts: { caption: string; diagramPrompt: string }
): Promise<{ buffer: Buffer; mimeType: string }> {
  const prompt =
    `${BRAND_STYLE_PROMPT}\n\n` +
    `以下の概念を表す、シンプルなイメージ図・概念図を描いてください。\n` +
    `概念: ${opts.diagramPrompt}\n` +
    `補足: ${opts.caption}\n\n` +
    `重要: 画像内に文字・数字・ラベル・グラフの軸などは一切含めないこと。純粋なビジュアル表現のみとする。`;
  const result = await client.images.generate({
    model: "gpt-image-1",
    prompt,
    size: "1024x1024",
    n: 1,
  });

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("gpt-image-1から概念図データを取得できませんでした");
  }
  return { buffer: Buffer.from(b64, "base64"), mimeType: "image/png" };
}
