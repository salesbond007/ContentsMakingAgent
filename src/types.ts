export interface KeywordRecord {
  id: string;
  keyword: string;
  usedAt?: string;
  articleId?: string;
  sourceUrls?: string[];
}

export type TopicSource = "ledger" | "internal-doc" | "competitor" | "trend";

export interface Topic {
  keyword: string;
  sourceUrls: string[];
  source: TopicSource;
  keywordRecordId?: string;
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
}

export interface GeneratedImage {
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
  status: "published" | "needs-review" | "rejected" | "skipped-error";
  microcmsContentId?: string;
  error?: string;
}

export interface PipelineRunSummary {
  startedAt: string;
  finishedAt: string;
  results: PipelineArticleResult[];
}
