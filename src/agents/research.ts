import type Anthropic from "@anthropic-ai/sdk";
import type { Env } from "../config.js";
import { competitorFeeds } from "../config.js";
import { MicroCmsClient } from "../clients/microcms.js";
import { fetchInternalDocs } from "../clients/googleDrive.js";
import { fetchRssItems } from "../clients/rss.js";
import { askClaudeForJson } from "../clients/claude.js";
import type { CtaOption } from "../clients/ctas.js";
import type { Topic } from "../types.js";
import { logger } from "../lib/logger.js";

/**
 * 情報収集エージェント。
 * 優先順位: ①社内資料・登録済みキーワード → ②競合/業界サイト → ③トレンド探索・RSS
 * キーワード台帳の消化を優先し、枯渇時のみAIによる自動探索で補う。
 */
export async function collectTopics(
  env: Env,
  claude: Anthropic,
  microcms: MicroCmsClient,
  count: number
): Promise<Topic[]> {
  const topics: Topic[] = [];

  // ① 登録済みキーワード台帳
  const ledgerKeywords = await microcms.getUnusedKeywords(count);
  for (const kw of ledgerKeywords) {
    if (topics.length >= count) break;
    topics.push({
      keyword: kw.keyword,
      sourceUrls: kw.sourceUrls ?? [],
      source: "ledger",
      keywordRecordId: kw.id,
    });
  }
  logger.info("キーワード台帳から取得", { found: ledgerKeywords.length });

  if (topics.length >= count) return topics.slice(0, count);

  // ① 社内資料（Googleドライブ）
  const internalDocs = await fetchInternalDocs(env);
  if (internalDocs.length > 0) {
    const remaining = count - topics.length;
    const suggestions = await askClaudeForJson<{ keyword: string }[]>(claude, {
      system:
        "あなたはBtoB向けAIメディア「BondAIメディア」の編集アシスタントです。" +
        "社内資料から記事化に値するキーワード・切り口を抽出してください。JSON配列のみを返してください。",
      prompt:
        `以下の社内資料の抜粋から、記事タイトルの元になるキーワードを${remaining}件提案してください。\n` +
        `出力形式: [{"keyword": "..."}]\n\n` +
        internalDocs.map((d) => `# ${d.name}\n${d.text.slice(0, 2000)}`).join("\n\n"),
    });
    for (const s of suggestions.slice(0, remaining)) {
      topics.push({ keyword: s.keyword, sourceUrls: [], source: "internal-doc" });
    }
  }

  if (topics.length >= count) return topics.slice(0, count);

  // ② 競合/業界サイト（RSS経由で巡回）
  const feeds = competitorFeeds(env);
  const rssItems = await fetchRssItems(feeds);
  for (const item of rssItems) {
    if (topics.length >= count) break;
    topics.push({ keyword: item.title, sourceUrls: [item.link], source: "competitor" });
  }

  if (topics.length >= count) return topics.slice(0, count);

  // ③ トレンド探索（AIによる自動探索でお題を補完）
  const remaining = count - topics.length;
  const trendTopics = await askClaudeForJson<{ keyword: string }[]>(claude, {
    system:
      "あなたはBtoB向けAIメディア「BondAIメディア」の編集アシスタントです。" +
      "AI・生成AI・業務効率化領域で、今読まれるべき記事テーマを考案してください。JSON配列のみを返してください。",
    prompt:
      `既存テーマと重複しない新しい記事テーマを${remaining}件、日本のBtoB読者向けに提案してください。\n` +
      `既存テーマ: ${topics.map((t) => t.keyword).join(", ") || "なし"}\n` +
      `出力形式: [{"keyword": "..."}]`,
  });
  for (const t of trendTopics.slice(0, remaining)) {
    topics.push({ keyword: t.keyword, sourceUrls: [], source: "trend" });
  }

  return topics.slice(0, count);
}

/**
 * 手動実行(GitHub Actionsのworkflow_dispatch)専用のお題を1件だけ組み立てる。
 * - keywordが指定されていればそれをそのまま使う。
 * - keyword未指定でCTAのみ指定されている場合は、そのCTAへ自然につながる記事テーマを
 *   AIに1件だけ逆算・提案させる（「CTAから逆算」ニーズへの対応）。
 */
export async function buildManualTopic(
  claude: Anthropic,
  manualKeyword: string | undefined,
  manualSourceUrls: string[],
  forcedCta: CtaOption | undefined,
  notes?: string,
  targetProfile?: string
): Promise<Topic> {
  if (manualKeyword) {
    return { keyword: manualKeyword, sourceUrls: manualSourceUrls, source: "manual", notes, targetProfile };
  }

  if (forcedCta) {
    const suggestion = await askClaudeForJson<{ keyword: string }>(claude, {
      system:
        "あなたはBtoB向けAIメディア「BondAIメディア」の編集アシスタントです。" +
        "指定されたCTA(行動喚起)へ読者が自然に進みたくなるような記事テーマを1つ提案してください。" +
        "JSONオブジェクトのみを返してください。",
      prompt:
        `CTA: ${forcedCta.label}\n用途: ${forcedCta.useWhen}\n\n` +
        `このCTAへ自然に読者を誘導できる記事キーワード・テーマを1つ考えてください。\n` +
        `出力形式: { "keyword": "..." }`,
    });
    return { keyword: suggestion.keyword, sourceUrls: manualSourceUrls, source: "manual", notes, targetProfile };
  }

  throw new Error("手動実行にはキーワードまたはCTA IDのいずれかを指定してください");
}
