import type Anthropic from "@anthropic-ai/sdk";
import { askClaudeForJson } from "../clients/claude.js";
import { logger } from "../lib/logger.js";
import type { SearchIntentInsight, Topic } from "../types.js";

/**
 * 検索意図分析エージェント。執筆前に、実際にキーワードでWeb検索(web_search)して
 * 上位に出てくる記事の見出し・切り口を確認し、「誰が・何に困って検索しているか」を言語化する。
 * あわせて、上位記事に共通して書かれている必須要素と、差別化できそうな余地を抽出する。
 *
 * これはSEO観点の「検索ボリューム・難易度」までは分からない(有料ツールが必要なため対象外)が、
 * 実際の検索結果を踏まえて書くことで、独りよがりな記事になるのを防ぐ役割を持つ。
 * 失敗しても記事生成全体は止めず、分析結果なし(undefined)で執筆に進む。
 */
export async function analyzeSearchIntent(
  claude: Anthropic,
  topic: Topic
): Promise<SearchIntentInsight | undefined> {
  try {
    return await askClaudeForJson<SearchIntentInsight>(claude, {
      system:
        "あなたはSEOの検索意図分析の専門家です。web_searchツールを使って、与えられたキーワードで" +
        "実際に検索した際に上位表示されそうな記事を調べ、その見出し構成・切り口を確認してください。" +
        "そのうえで、検索意図の分析結果をJSONオブジェクトのみで返してください。",
      prompt:
        `キーワード: ${topic.keyword}\n\n` +
        `このキーワードで検索するユーザーが「誰で」「何に困っているか」を1文で言語化し、` +
        `上位記事に共通して書かれている必須要素、まだあまり書かれていない差別化の余地を教えてください。\n\n` +
        `出力形式(JSON):\n` +
        `{\n` +
        `  "intentSummary": "誰が、何に困って検索しているかを1文で",\n` +
        `  "mustHaveElements": ["上位記事に共通する必須要素1", "必須要素2"],\n` +
        `  "differentiationOpportunity": "まだあまり書かれていない、差別化できそうな切り口"\n` +
        `}`,
      enableWebTools: true,
    });
  } catch (err) {
    logger.warn("検索意図分析に失敗しました。分析結果なしで執筆に進みます。", {
      keyword: topic.keyword,
      error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}
