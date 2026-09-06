import type Anthropic from "@anthropic-ai/sdk";
import { askClaudeForJson } from "../clients/claude.js";
import type { CtaOption } from "../clients/ctas.js";
import type { ArticleDraft, FigureSpec, Topic } from "../types.js";

interface WritingLlmOutput {
  title: string;
  excerpt: string;
  body: string;
  category: string;
  tags: string[];
  seo: { metaTitle: string; metaDescription: string };
  ctaId: string;
  figures?: {
    token: string;
    type: "chart" | "diagram";
    caption: string;
    chart?: { labels: string[]; series: { name: string; values: number[] }[] };
    diagramPrompt?: string;
  }[];
}

const DEFAULT_CATEGORY = "未分類";
const NO_CTA = "none";
const MAX_FIGURES = 2;

/**
 * ライティングエージェント。記事本文の執筆に加え、カテゴリの自己分類・SEOメタ情報の生成・
 * 記事末尾のCTA(行動喚起)選定・本文中の図解(グラフ/概念図)の指示までを担う。
 * 査読エージェントはカテゴリのダブルチェックを行わない前提のため、ここで確定させる。
 *
 * カテゴリは固定リストを持たず、AIが記事内容に応じて自由に決める。ただし表記ゆれ（似た意味の
 * カテゴリが乱立すること）を防ぐため、既存記事で使われているカテゴリ一覧を毎回プロンプトに渡し、
 * 可能な限り既存のものを再利用するよう指示する。
 *
 * CTAはカテゴリと異なり、実在するURLへのリンクを扱う。AIにURLそのものを生成させるとハルシネーション
 * (存在しないURLのでっち上げ)のリスクがあるため、config/ctas.json に事前登録された選択肢の中から
 * 記事内容に最も合うものをIDで選ばせ、コード側で実URLを本文末尾に挿入する。
 *
 * 図解も同様に、AIには「どういう図を、どこに入れるか」だけを決めさせ、実際の画像化は行わせない。
 * 数値を伴うグラフはコード側で正確にSVG描画し（AIに正確なグラフを描かせることはできないため）、
 * 数値を伴わない概念図のみAI画像生成を使う（文字は入れない）。
 */
export async function writeArticle(
  claude: Anthropic,
  topic: Topic,
  existingCategories: string[] = [],
  ctaOptions: CtaOption[] = []
): Promise<ArticleDraft> {
  const output = await askClaudeForJson<WritingLlmOutput>(claude, {
    system:
      "あなたはBtoB向けAIメディア「BondAIメディア」のライターです。" +
      "断定的な保証表現（『必ず』『保証します』等）や誇大な効果訴求を避け、" +
      "根拠のある落ち着いたトーンで執筆してください。" +
      "参考ソースURLが与えられた場合は、必ずweb_fetchツールで実際にページ内容を取得し、" +
      "そこに書かれている事実に基づいて執筆してください。URLの文字面だけで内容を推測して書かないこと。" +
      "情報が古い・不足している場合や、参考ソースが無い場合は、web_searchツールで補足の裏付け情報を検索して構いません。" +
      "本文は h2/h3/p/ul/li/strong/table/thead/tbody/tr/th/td 等のタグのみを使ったHTML断片として出力し、" +
      "html/head/bodyタグやMarkdown記法（##、**太字**など）は使わないでください。" +
      "比較・一覧など表形式で示した方が分かりやすい情報は、積極的にtableタグを使うこと。" +
      "CTAへのリンクは本文に含めないこと(別途挿入する)。" +
      "図解を入れる場合は、本文中の該当箇所に `[[FIGURE:任意のトークン名]]` というプレースホルダーを" +
      "1行で挿入し、figuresフィールドに対応する情報を記載すること（記事全体で最大2つまで）。" +
      "グラフ(chart)は、web_fetch/web_searchで実際に確認した具体的な数値データがある場合のみ使うこと。" +
      "架空の数値を作ってはいけない。概念図(diagram)は、プロセスや関係性を視覚的に示したい場合に使い、" +
      "画像内に文字や数字を入れない前提でdiagramPromptに描いてほしい内容を英語または日本語で簡潔に書くこと。" +
      "図解を入れる必要が無ければfiguresは空配列にしてよい。" +
      "ツール呼び出しが終わったら、最後に必ずJSONオブジェクトのみを返してください。",
    prompt:
      `以下のキーワード・参考ソースをもとに記事を執筆してください。\n\n` +
      `キーワード: ${topic.keyword}\n` +
      `参考ソースURL: ${topic.sourceUrls.join(", ") || "なし"}\n\n` +
      `既存のカテゴリ一覧（できるだけこの中から適切なものを再利用してください。` +
      `どれも当てはまらない場合のみ、新しい簡潔なカテゴリ名を作成してください）:\n` +
      `${existingCategories.join(", ") || "まだ既存カテゴリはありません"}\n\n` +
      `選択可能なCTA一覧（記事内容に最も合うものを1つ選び、そのidを回答してください。` +
      `どれも合わない場合は"${NO_CTA}"としてください。ここに無いCTAを新しく作ってはいけません）:\n` +
      (ctaOptions.length > 0
        ? ctaOptions.map((c) => `- id: "${c.id}" / 用途: ${c.useWhen}`).join("\n")
        : "利用可能なCTAはありません") +
      `\n\n出力形式(JSON):\n` +
      `{\n` +
      `  "title": "記事タイトル",\n` +
      `  "excerpt": "100字程度の要約",\n` +
      `  "body": "HTML断片の本文(1500〜2500字程度、h2/h3見出し・pタグ・ul/li・必要に応じてtableを使用)",\n` +
      `  "category": "カテゴリ名(既存の再利用、または新規の簡潔な名称)",\n` +
      `  "tags": ["タグ1", "タグ2"],\n` +
      `  "seo": { "metaTitle": "32字程度", "metaDescription": "120字程度" },\n` +
      `  "ctaId": "選んだCTAのid、または\\"${NO_CTA}\\"",\n` +
      `  "figures": [\n` +
      `    {\n` +
      `      "token": "本文中のプレースホルダーと一致するトークン名",\n` +
      `      "type": "chart または diagram",\n` +
      `      "caption": "図の説明文(altテキストにもなる)",\n` +
      `      "chart": { "labels": ["項目1", "項目2"], "series": [{ "name": "系列名", "values": [数値, 数値] }] },\n` +
      `      "diagramPrompt": "概念図として描いてほしい内容(chartの場合は省略)"\n` +
      `    }\n` +
      `  ]\n` +
      `}`,
    maxTokens: 8192,
    enableWebTools: true,
  });

  const selectedCta = ctaOptions.find((c) => c.id === output.ctaId);
  const body = selectedCta ? appendCta(output.body, selectedCta) : output.body;
  const figures = normalizeFigures(output.figures);

  return {
    title: output.title,
    excerpt: output.excerpt,
    body,
    category: output.category?.trim() || DEFAULT_CATEGORY,
    tags: output.tags ?? [],
    seo: output.seo,
    topic,
    figures,
  };
}

function appendCta(body: string, cta: CtaOption): string {
  return `${body}\n<p class="cta"><a href="${cta.url}" rel="noopener">${cta.buttonText}</a></p>`;
}

/** LLM出力を検証し、chart/diagramそれぞれに必要な情報が揃っているものだけを残す。 */
function normalizeFigures(raw: WritingLlmOutput["figures"]): FigureSpec[] {
  if (!Array.isArray(raw)) return [];

  const valid = raw.filter((f): f is FigureSpec => {
    if (!f.token || !f.caption) return false;
    if (f.type === "chart") return !!f.chart?.labels?.length && !!f.chart?.series?.length;
    if (f.type === "diagram") return !!f.diagramPrompt;
    return false;
  });

  return valid.slice(0, MAX_FIGURES);
}
