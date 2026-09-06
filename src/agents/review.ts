import type Anthropic from "@anthropic-ai/sdk";
import { askClaudeForJson } from "../clients/claude.js";
import type { ArticleDraft, ReviewResult, ReviewScores, ReviewVerdict } from "../types.js";
import type { Env } from "../config.js";

/**
 * 4観点（事実確認／リスク表現／ブランド・トンマナ／剽窃・重複）を各25点でスコアリングし、
 * 合計点からしきい値に基づいて判定する（純粋関数・テスト容易性のため分離）。
 */
export function decideVerdict(scores: ReviewScores, env: Pick<Env, "REVIEW_AUTO_PUBLISH_THRESHOLD" | "REVIEW_NEEDS_CHECK_THRESHOLD">): {
  total: number;
  verdict: ReviewVerdict;
} {
  const total =
    scores.factCheck + scores.riskExpression + scores.brandToneManner + scores.plagiarismDuplication;

  let verdict: ReviewVerdict;
  if (total >= env.REVIEW_AUTO_PUBLISH_THRESHOLD) {
    verdict = "auto-publish";
  } else if (total >= env.REVIEW_NEEDS_CHECK_THRESHOLD) {
    verdict = "needs-review";
  } else {
    verdict = "rejected";
  }

  return { total, verdict };
}

interface ReviewLlmOutput {
  scores: ReviewScores;
  comments: string[];
}

export async function reviewArticle(
  claude: Anthropic,
  draft: ArticleDraft,
  env: Pick<Env, "REVIEW_AUTO_PUBLISH_THRESHOLD" | "REVIEW_NEEDS_CHECK_THRESHOLD">,
  existingArticleTitles: string[] = []
): Promise<ReviewResult> {
  const output = await askClaudeForJson<ReviewLlmOutput>(claude, {
    system:
      "あなたはBondAIメディアの査読・ファクトチェック担当者です。以下の4観点をそれぞれ0〜25点で採点してください。\n" +
      "1. 事実確認: 参考ソースURLがあれば、必ずweb_fetchツールで実際にページ内容を取得し、\n" +
      "   本文中の主張・数値がその内容と本当に整合しているか確認すること。文面の印象だけで判定しないこと。\n" +
      "   出典が無い、または出典で確認できない重要な断定は減点。判断に迷う数値・固有名詞はweb_searchで裏付けを取ってよい。\n" +
      "2. リスク表現: 「必ず」「保証します」等の断定的表現、誇大な効果訴求が無いか。\n" +
      "3. ブランド・トンマナ: BtoBメディアとして落ち着いた文体・語彙になっているか。\n" +
      "4. 剽窃・重複: 出典の丸写しや不自然な類似表現が無いか。加えて「既存の自社記事タイトル一覧」と\n" +
      "   テーマ・切り口が実質的に重複していないかも確認し、重複していれば減点すること。\n" +
      "カテゴリの妥当性は採点対象に含めないこと（ライティング側で確定済み）。" +
      "ツール呼び出しが終わったら、最後に必ずJSONオブジェクトのみを返してください。",
    prompt:
      `記事タイトル: ${draft.title}\n` +
      `参考ソースURL: ${draft.topic.sourceUrls.join(", ") || "なし"}\n` +
      `既存の自社記事タイトル一覧（直近${existingArticleTitles.length}件）:\n` +
      `${existingArticleTitles.map((t) => `- ${t}`).join("\n") || "なし"}\n\n` +
      `本文:\n${draft.body}\n\n` +
      `出力形式(JSON):\n` +
      `{\n` +
      `  "scores": { "factCheck": 0-25, "riskExpression": 0-25, "brandToneManner": 0-25, "plagiarismDuplication": 0-25 },\n` +
      `  "comments": ["指摘事項1", "指摘事項2"]\n` +
      `}`,
    enableWebTools: true,
  });

  const { total, verdict } = decideVerdict(output.scores, env);

  return {
    scores: output.scores,
    total,
    verdict,
    comments: output.comments ?? [],
  };
}
