export interface KeywordRecord {
  id: string;
  keyword: string;
  usedAt?: string;
  articleId?: string;
  sourceUrls?: string[];
}

export type TopicSource = "ledger" | "internal-doc" | "competitor" | "trend" | "manual";

export interface Topic {
  keyword: string;
  sourceUrls: string[];
  source: TopicSource;
  keywordRecordId?: string;
  /** 手動実行時に指定された、記事に必ず盛り込んでほしい内容(自由記述)。 */
  notes?: string;
  /** 手動実行時に指定された、想定読者・ターゲット属性(登録済みプロフィールの説明文、または自由記述)。 */
  targetProfile?: string;
}

/**
 * 執筆前に行う検索意図分析の結果。実際にWeb検索で上位表示されている記事の見出し等を踏まえ、
 * 「誰が・何に困って検索しているか」を言語化し、必須要素・差別化の余地を抽出したもの。
 * 取得に失敗した場合はundefinedのまま執筆に進む（無くても記事は書けるため必須ではない）。
 */
export interface SearchIntentInsight {
  intentSummary: string;
  mustHaveElements: string[];
  differentiationOpportunity: string;
}

export interface ArticleDraft {
  title: string;
  excerpt: string;
  body: string;
  category: string;
  tags: string[];
  seo: {
    metaTitle: string;
    metaDescription: string;
  };
  topic: Topic;
  figures: FigureSpec[];
  /** タイトルA/B案(執筆エージェントが提示する代替タイトル、人間が下書き確認時に選べるよう査読コメントに記載する)。 */
  altTitles?: string[];
}

export interface GeneratedImage {
  buffer: Buffer;
  mimeType: string;
  altText: string;
}

/**
 * 本文中に挿入する図解の指示。bodyには `[[FIGURE:token]]` というプレースホルダーが埋め込まれており、
 * 画像生成後にそのプレースホルダーを実際の<img>タグへ置き換える。
 * - chart: 出典等から得た実データに基づく正確なグラフ（AI画像生成は使わず、コード側でSVG描画する）
 * - diagram: 数値を伴わない概念図・イメージ図（gpt-image-1で生成。誤情報防止のため文字は入れない）
 */
export interface FigureSpec {
  token: string;
  type: "chart" | "diagram";
  caption: string;
  chart?: {
    labels: string[];
    series: { name: string; values: number[] }[];
  };
  diagramPrompt?: string;
}

export interface RenderedFigure {
  token: string;
  buffer: Buffer;
  mimeType: string;
  altText: string;
}

export interface ReviewScores {
  factCheck: number; // 事実確認 /25
  riskExpression: number; // リスク表現 /25
  brandToneManner: number; // ブランド・トンマナ /25
  plagiarismDuplication: number; // 剽窃・重複 /25
}

export type ReviewVerdict = "auto-publish" | "needs-review" | "rejected";

export interface ReviewResult {
  scores: ReviewScores;
  total: number;
  verdict: ReviewVerdict;
  comments: string[];
}

export interface PipelineArticleResult {
  topic: Topic;
  draft?: ArticleDraft;
  image?: GeneratedImage;
  review?: ReviewResult;
  status: "published" | "needs-review" | "rejected" | "skipped-error" | "pending-review";
  microcmsContentId?: string;
  error?: string;
}

/**
 * 手動生成の記事が、管理画面での人間の確認を経てCMSへ反映されるまでの間、
 * 一時的に保管しておくためのキュー1件分。画像はこの時点でmicroCMSのメディアライブラリに
 * アップロード済みで、bodyの図解プレースホルダーも実際の<img>タグに解決済み(承認時に
 * 再アップロードが不要になるようにするため)。
 */
export interface ReviewQueueItem {
  id: string;
  createdAt: string;
  draft: ArticleDraft;
  eyecatch?: { url: string; alt: string };
  review: ReviewResult;
}

export interface PipelineRunSummary {
  startedAt: string;
  finishedAt: string;
  results: PipelineArticleResult[];
}
