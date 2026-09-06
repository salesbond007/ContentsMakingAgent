import { describe, expect, it } from "vitest";
import { buildManualTopic } from "../src/agents/research.js";
import type Anthropic from "@anthropic-ai/sdk";

describe("buildManualTopic", () => {
  it("keywordが指定されていればClaudeを呼ばずにそのまま使う", async () => {
    const topic = await buildManualTopic(
      null as unknown as Anthropic,
      "生成AIの導入事例",
      ["https://example.com/a"],
      undefined
    );

    expect(topic).toEqual({
      keyword: "生成AIの導入事例",
      sourceUrls: ["https://example.com/a"],
      source: "manual",
    });
  });

  it("keywordもCTAも無ければエラーになる", async () => {
    await expect(
      buildManualTopic(null as unknown as Anthropic, undefined, [], undefined)
    ).rejects.toThrow(/キーワードまたはCTA/);
  });
});
