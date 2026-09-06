import Anthropic from "@anthropic-ai/sdk";
import type { Env } from "../config.js";

export function createClaudeClient(env: Env): Anthropic {
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
}

/**
 * Web検索・Web取得ツール。有効化すると、Claudeが出典URLを実際に取得(web_fetch)したり、
 * 補足情報をWeb検索(web_search)したりしたうえで回答を生成できるようになる。
 * 記事本文の正確性(出典に基づく執筆・ファクトチェック)を高めるために、
 * ライティング・査読エージェントで有効化している。
 */
const WEB_TOOLS = [
  { type: "web_fetch_20260209", name: "web_fetch", max_uses: 5 },
  { type: "web_search_20260209", name: "web_search", max_uses: 3 },
] as unknown as Anthropic.Tool[];

/**
 * Claudeにテキストプロンプトを送り、モデルが返したテキストのうち最初のJSONオブジェクト/配列を抽出してパースする。
 * 構造化出力を強制するため、プロンプト側で「JSONのみを返す」ことを明示すること。
 */
export async function askClaudeForJson<T>(
  client: Anthropic,
  opts: { system: string; prompt: string; model?: string; maxTokens?: number; enableWebTools?: boolean }
): Promise<T> {
  const message = await client.messages.create({
    model: opts.model ?? "claude-sonnet-5",
    max_tokens: opts.maxTokens ?? 4096,
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
    ...(opts.enableWebTools ? { tools: WEB_TOOLS } : {}),
  });

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error(`Claudeの応答からJSONを抽出できませんでした: ${text.slice(0, 500)}`);
  }
  return JSON.parse(jsonMatch[0]) as T;
}
