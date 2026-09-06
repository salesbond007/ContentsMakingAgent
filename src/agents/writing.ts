import type Anthropic from "@anthropic-ai/sdk";
import { askClaudeForJson } from "../clients/claude.js";
import type { CtaOption } from "../clients/ctas.js";
import type { StyleReference } from "../clients/styleReferences.js";
import type { ArticleDraft, FigureSpec, SearchIntentInsight, Topic } from "../types.js";

export interface InternalLinkCandidate {
  title: string;
  url: string;
}

interface WritingLlmOutput {
  title: string;
  altTitles?: string[];
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
const MAX_FIGURES = 3;

/**
 * ライティングエージェント。記事本文の執筆に加え、カテゴリの自己分類・SEOメタ情報の生成・
 * 記事中のCTA(行動喚起)選定・配置・本文中の図解(グラフ/概念図)の指示までを担う。
 * 査読エージェントはカテゴリのダブルチェックを行わない前提のため、ここで確定させる。
 *
 * カテゴリは固定リストを持たず、AIが記事内容に応じて自由に決める。ただし表記ゆれ（似た意味の
 * カテゴリが乱立すること）を防ぐため、既存記事で使われているカテゴリ一覧を毎回プロンプトに渡し、
 * 可能な限り既存のものを再利用するよう指示する。
 *
 * CTAはカテゴリと異なり、実在するURLへのリンクを扱う。AIにURLそのものを生成させるとハルシネーション
 * (存在しないURLのでっち上げ)のリスクがあるため、config/ctas.json に事前登録された選択肢の中から
 * 記事内容に最も合うものをIDで選ばせ、コード側で実URLを本文に挿入する。同じCTAを
 * 「導入直後(バナー)」「本文中の課題提起後(インライン)」「記事末(フッター)」の3箇所に配置する。
 *
 * 図解も同様に、AIには「どういう図を、どこに入れるか」だけを決めさせ、実際の画像化は行わせない。
 * 数値を伴うグラフはコード側で正確にSVG描画し（AIに正確なグラフを描かせることはできないため）、
 * 数値を伴わない概念図のみAI画像生成を使う（文字は入れない）。
 */
export async function writeArticle(
  claude: Anthropic,
  topic: Topic,
  existingCategories: string[] = [],
  ctaOptions: CtaOption[] = [],
  forcedCtaId?: string,
  styleReferences: StyleReference[] = [],
  searchIntent?: SearchIntentInsight,
  internalLinkCandidates: InternalLinkCandidate[] = []
): Promise<ArticleDraft> {
  const output = await askClaudeForJson<WritingLlmOutput>(claude, {
    system:
      "あなたはBtoB向けAIメディア「BondAIメディア」のライターです。" +
      "断定的な保証表現（『必ず』『保証します』等）や誇大な効果訴求を避け、" +
      "根拠のある落ち着いたトーンで執筆してください。" +
      (styleReferences.length > 0
        ? "文体・構成のお手本として指定された参考記事があります。必ずweb_fetchツールで実際に取得し、" +
          "見出しの立て方・段落構成・語り口・言葉遣いのトーンといった「構造とトーン」だけを参考にしてください。" +
          "参考記事は業界・商材が全く異なる場合があるため、書かれている内容・事実・数値・固有名詞・具体例を" +
          "一切転載・流用してはいけません（あくまで型・雰囲気の参考であり、中身はこの記事のテーマに即して" +
          "ゼロから執筆すること）。\n" +
          styleReferences.map((r) => `- ${r.url}（${r.note}）`).join("\n") +
          "\n"
        : "") +
      "参考ソースURLが与えられた場合は、必ずweb_fetchツールで実際にページ内容を取得し、" +
      "そこに書かれている事実に基づいて執筆してください。URLの文字面だけで内容を推測して書かないこと。" +
      "情報が古い・不足している場合や、参考ソースが無い場合は、web_searchツールで補足の裏付け情報を検索して構いません。" +
      "本文は h2/h3/p/ul/li/strong/table/thead/tbody/tr/th/td 等のタグのみを使ったHTML断片として出力し、" +
      "html/head/bodyタグやMarkdown記法（##、**太字**など）は使わないでください。" +
      "比較・一覧など表形式で示した方が分かりやすい情報は、積極的にtableタグを使うこと。" +
      "SEOのため、以下を必ず守ること: " +
      "(1) 見出し階層を正しく使う。大見出しはすべてh2にし、その中の細かい論点だけh3にする。" +
      "h2を飛ばしていきなりh3から始めたり、h3の後に再びh2に戻ったりしないこと。" +
      "(2) 与えられたキーワードを、最初の1〜2段落以内と、本文中に自然な形で複数回登場させること。" +
      "ただし不自然な詰め込み（キーワードスタッフィング）は絶対にしないこと。" +
      "(3) seoMetaTitleは30文字前後でキーワードを含み、seoMetaDescriptionは120文字前後で" +
      "キーワードを含みつつ読者がクリックしたくなる具体的な内容にすること。" +
      "(4) 各見出し(h2/h3)は結論を最初の一文で述べてから、理由・詳細を続けること（結論ファースト）。" +
      "1つのh2セクションあたり300〜500字程度を目安にする（短すぎる断片的な記述、長すぎる冗長な記述を避ける）。" +
      "(5) web_fetch/web_searchで実際に確認できた具体的な事例・数値があれば、本文中に最低1つ盛り込むこと。" +
      "ただし実際に確認できた情報が無い場合、自社の実績や数値、顧客の声を絶対に創作してはいけない" +
      "（一般的な説明のみで執筆すること。存在しない自社データをでっち上げるのはファクトチェックで必ず問題になる）。" +
      (searchIntent
        ? "\n検索意図分析の結果が与えられています。想定読者の悩みに正面から答える書き出しにし、" +
          "上位記事に共通する必須要素は漏らさず盛り込み、差別化の余地として挙げられた切り口も意識して執筆してください。\n"
        : "") +
      (topic.targetProfile
        ? "想定読者・ターゲット属性が指定されている場合は、その読者層に響く言葉遣い・課題設定・具体例になるよう" +
          "強く意識して執筆してください。\n"
        : "") +
      "CTAは本文に3箇所配置する。選んだCTAが決まったら、" +
      "導入文(最初の1〜2段落)の直後に `[[CTA_BANNER]]`、本文中で読者の課題・悩みに触れた直後に" +
      "`[[CTA_INLINE]]` というプレースホルダーをそれぞれ1回ずつ、本文とは別の行に挿入すること" +
      "（記事末のCTAは別途自動で追加されるので、本文中に自分でリンクを書かないこと）。" +
      "ctaIdが\"" + NO_CTA + "\"の場合は、これらのプレースホルダーを一切入れないこと。" +
      "図解を入れる場合は、本文中の該当箇所に `[[FIGURE:任意のトークン名]]` というプレースホルダーを" +
      `1行で挿入し、figuresフィールドに対応する情報を記載すること（記事全体で最大${MAX_FIGURES}つまで）。` +
      "グラフ(chart)は、web_fetch/web_searchで実際に確認した具体的な数値データがある場合のみ使うこと。" +
      "架空の数値を作ってはいけない。概念図(diagram)は、プロセスや関係性を視覚的に示したい場合に使い、" +
      "画像内に文字や数字を入れない前提でdiagramPromptに描いてほしい内容を英語または日本語で簡潔に書くこと。" +
      "図解を入れる必要が無ければfiguresは空配列にしてよい。" +
      (internalLinkCandidates.length > 0
        ? "\n内部リンク候補として、自社の既存公開記事一覧が与えられています。本文の趣旨と本当に関連するものが" +
          "あれば、自然な文脈で1〜2個だけ `<a href=\"URL\">記事タイトルなど自然なアンカーテキスト</a>` の形で" +
          "本文中に挿入すること。関連する記事が無ければ無理に入れなくてよい。ここに無いURLを作ってはいけない。\n" +
          internalLinkCandidates.map((c) => `- ${c.title}: ${c.url}`).join("\n") +
          "\n"
        : "") +
      "titleとは別に、altTitlesとして雰囲気の異なるタイトル案を2つ提示すること" +
      "(例: 数字を使った案、疑問形の案など)。これは人間が下書き確認時にA/Bとして選べるようにするための" +
      "参考であり、本文中では使わない。" +
      "ツール呼び出しが終わったら、最後に必ずJSONオブジェクトのみを返してください。",
    prompt:
      `以下のキーワード・参考ソースをもとに記事を執筆してください。\n\n` +
      `キーワード: ${topic.keyword}\n` +
      `参考ソースURL: ${topic.sourceUrls.join(", ") || "なし"}\n` +
      (topic.notes ? `記事に必ず盛り込んでほしい内容(依頼者からの指定): ${topic.notes}\n` : "") +
      (topic.targetProfile ? `想定読者・ターゲット属性(依頼者からの指定): ${topic.targetProfile}\n` : "") +
      `\n` +
      (searchIntent
        ? `検索意図分析の結果:\n` +
          `- 想定読者・悩み: ${searchIntent.intentSummary}\n` +
          `- 上位記事に共通する必須要素: ${searchIntent.mustHaveElements.join(", ") || "なし"}\n` +
          `- 差別化の余地: ${searchIntent.differentiationOpportunity}\n\n`
        : "") +
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
      `  "altTitles": ["代替タイトル案1", "代替タイトル案2"],\n` +
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

  // 手動実行でCTAが指定されている場合は、AIの選択より必ず優先する。
  const selectedCta = forcedCtaId
    ? ctaOptions.find((c) => c.id === forcedCtaId)
    : ctaOptions.find((c) => c.id === output.ctaId);
  const body = insertCtas(output.body, selectedCta);
  const figures = normalizeFigures(output.figures);

  return {
    title: output.title,
    altTitles: Array.isArray(output.altTitles) ? output.altTitles.filter(Boolean).slice(0, 2) : [],
    excerpt: output.excerpt,
    body,
    category: output.category?.trim() || DEFAULT_CATEGORY,
    tags: output.tags ?? [],
    seo: output.seo,
    topic,
    figures,
  };
}

/**
 * 本文中のCTAプレースホルダーを実際のリンクに置き換える。CTAが無い場合はプレースホルダーを除去し、
 * 記事末のCTA(フッター)を追加しない。3箇所とも同じCTA（同じURL）だが、サイト側でのスタイル分けが
 * できるようclassを分けている。
 */
export function insertCtas(body: string, cta: CtaOption | undefined): string {
  if (!cta) {
    return body.replace(/\[\[CTA_BANNER\]\]/g, "").replace(/\[\[CTA_INLINE\]\]/g, "");
  }

  const link = (className: string) => `<p class="${className}"><a href="${cta.url}" rel="noopener">${cta.buttonText}</a></p>`;

  const withBanner = body.replace(/\[\[CTA_BANNER\]\]/g, link("cta-banner"));
  const withInline = withBanner.replace(/\[\[CTA_INLINE\]\]/g, link("cta-inline"));
  return `${withInline}\n${link("cta-footer")}`;
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
