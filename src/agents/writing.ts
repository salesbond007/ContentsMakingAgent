import type Anthropic from "@anthropic-ai/sdk";
import { askClaudeForJson } from "../clients/claude.js";
import type { ArticleDraft, Topic } from "../types.js";

interface WritingLlmOutput {
  title: string;
  excerpt: string;
  body: string;
  category: string;
  tags: string[];
  seo: { metaTitle: string; metaDescription: string };
}

const CATEGORY_OPTIONS = [
  "AI活用事例",
  "業務効率化",
  "生成AIニュース",
  "ツール比較・選定",
  "組織・マネジメント",
];

/**
 * ライティングエージェント。記事本文の執筆に加え、カテゴリの自己分類とSEOメタ情報の生成まで担う。
 * 査読エージェントはカテゴリのダブルチェックを行わない前提のため、ここで確定させる。
 */
export async function writeArticle(claude: Anthropic, topic: Topic): Promise<ArticleDraft> {
  const output = await askClaudeForJson<WritingLlmOutput>(claude, {
    system:
      "あなたはBtoB向けAIメディア「BondAIメディア」のライターです。" +
      "断定的な保証表現（『必ず』『保証します』等）や誇大な効果訴求を避け、" +
      "根拠のある落ち着いたトーンで執筆してください。JSONオブジェクトのみを返してください。",
    prompt:
      `以下のキーワード・参考ソースをもとに記事を執筆してください。\n\n` +
      `キーワード: ${topic.keyword}\n` +
      `参考ソースURL: ${topic.sourceUrls.join(", ") || "なし"}\n\n` +
      `出力形式(JSON):\n` +
      `{\n` +
      `  "title": "記事タイトル",\n` +
      `  "excerpt": "100字程度の要約",\n` +
      `  "body": "Markdown形式の本文(1500〜2500字程度、見出し・箇条書きを適宜使用)",\n` +
      `  "category": "${CATEGORY_OPTIONS.join(" | ")} のいずれか",\n` +
      `  "tags": ["タグ1", "タグ2"],\n` +
      `  "seo": { "metaTitle": "32字程度", "metaDescription": "120字程度" }\n` +
      `}`,
    maxTokens: 8192,
  });

  return {
    title: output.title,
    excerpt: output.excerpt,
    body: output.body,
    category: CATEGORY_OPTIONS.includes(output.category) ? output.category : CATEGORY_OPTIONS[0],
    tags: output.tags ?? [],
    seo: output.seo,
    topic,
  };
}
