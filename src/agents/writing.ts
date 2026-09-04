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

const DEFAULT_CATEGORY = "未分類";

/**
 * ライティングエージェント。記事本文の執筆に加え、カテゴリの自己分類とSEOメタ情報の生成まで担う。
 * 査読エージェントはカテゴリのダブルチェックを行わない前提のため、ここで確定させる。
 *
 * カテゴリは固定リストを持たず、AIが記事内容に応じて自由に決める。ただし表記ゆれ（似た意味の
 * カテゴリが乱立すること）を防ぐため、既存記事で使われているカテゴリ一覧を毎回プロンプトに渡し、
 * 可能な限り既存のものを再利用するよう指示する。
 */
export async function writeArticle(
  claude: Anthropic,
  topic: Topic,
  existingCategories: string[] = []
): Promise<ArticleDraft> {
  const output = await askClaudeForJson<WritingLlmOutput>(claude, {
    system:
      "あなたはBtoB向けAIメディア「BondAIメディア」のライターです。" +
      "断定的な保証表現（『必ず』『保証します』等）や誇大な効果訴求を避け、" +
      "根拠のある落ち着いたトーンで執筆してください。" +
      "本文は h2/h3/p/ul/li/strong 等のタグのみを使ったHTML断片として出力し、" +
      "html/head/bodyタグやMarkdown記法（##、**太字**など）は使わないでください。" +
      "JSONオブジェクトのみを返してください。",
    prompt:
      `以下のキーワード・参考ソースをもとに記事を執筆してください。\n\n` +
      `キーワード: ${topic.keyword}\n` +
      `参考ソースURL: ${topic.sourceUrls.join(", ") || "なし"}\n\n` +
      `既存のカテゴリ一覧（できるだけこの中から適切なものを再利用してください。` +
      `どれも当てはまらない場合のみ、新しい簡潔なカテゴリ名を作成してください）:\n` +
      `${existingCategories.join(", ") || "まだ既存カテゴリはありません"}\n\n` +
      `出力形式(JSON):\n` +
      `{\n` +
      `  "title": "記事タイトル",\n` +
      `  "excerpt": "100字程度の要約",\n` +
      `  "body": "HTML断片の本文(1500〜2500字程度、h2/h3見出し・pタグ・ul/liを適宜使用)",\n` +
      `  "category": "カテゴリ名(既存の再利用、または新規の簡潔な名称)",\n` +
      `  "tags": ["タグ1", "タグ2"],\n` +
      `  "seo": { "metaTitle": "32字程度", "metaDescription": "120字程度" }\n` +
      `}`,
    maxTokens: 8192,
  });

  return {
    title: output.title,
    excerpt: output.excerpt,
    body: output.body,
    category: output.category?.trim() || DEFAULT_CATEGORY,
    tags: output.tags ?? [],
    seo: output.seo,
    topic,
  };
}
