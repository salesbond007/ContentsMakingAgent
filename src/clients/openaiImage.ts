import OpenAI from "openai";
import type { Env } from "../config.js";

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
  opts: { title: string; excerpt: string }
): Promise<{ buffer: Buffer; mimeType: string }> {
  const prompt = `${BRAND_STYLE_PROMPT}\n\n記事タイトル: ${opts.title}\n記事の要約: ${opts.excerpt}`;
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
