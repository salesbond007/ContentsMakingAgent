import Anthropic from "@anthropic-ai/sdk";
import type { Env } from "../config.js";

export function createClaudeClient(env: Env): Anthropic {
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
}

/**
 * Claudeにテキストプロンプトを送り、モデルが返したテキストのうち最初のJSONオブジェクト/配列を抽出してパースする。
 * 構造化出力を強制するため、プロンプト側で「JSONのみを返す」ことを明示すること。
 */
export async function askClaudeForJson<T>(
  client: Anthropic,
  opts: { system: string; prompt: string; model?: string; maxTokens?: number }
): Promise<T> {
  const message = await client.messages.create({
    model: opts.model ?? "claude-sonnet-5",
    max_tokens: opts.maxTokens ?? 4096,
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
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
