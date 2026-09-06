// パイプライン側(src/clients/ctas.ts, src/clients/referenceMaterials.ts 等)の型と同じ形。
// 管理画面はパイプラインのソースを直接importせず、config/*.jsonの構造だけを共有する。

export interface CtaOption {
  id: string;
  label: string;
  url: string;
  buttonText: string;
  useWhen: string;
}

export interface CtasFile {
  _comment?: string;
  _internal_link_comment?: string;
  ctas: CtaOption[];
}

export type ReferenceMaterialType = "style" | "service";

export interface ReferenceMaterial {
  id: string;
  type: ReferenceMaterialType;
  label: string;
  urls: string[];
  memo: string;
}

export interface ReferenceMaterialsFile {
  _comment?: string;
  materials: ReferenceMaterial[];
}

export type ImageUseCase = "chart" | "seminar" | "thumbnail";

export interface ImageEntry {
  id: string;
  title: string;
  url: string;
  useCase: ImageUseCase;
  note?: string;
}

export interface ImagesFile {
  _comment?: string;
  images: ImageEntry[];
}

export interface GlobalSettingsFile {
  _comment?: string;
  mustNotViolate: string;
}

export interface TargetProfile {
  id: string;
  label: string;
  description: string;
}

export interface TargetsFile {
  _comment?: string;
  targets: TargetProfile[];
}

// src/types.ts の ArticleDraft/ReviewResult/ReviewQueueItem と同じ形(表示に必要な分のみ)。

export interface ReviewScores {
  factCheck: number;
  riskExpression: number;
  brandToneManner: number;
  plagiarismDuplication: number;
}

export interface ReviewResult {
  scores: ReviewScores;
  total: number;
  verdict: "auto-publish" | "needs-review" | "rejected";
  comments: string[];
}

export interface ArticleDraftSummary {
  title: string;
  altTitles?: string[];
  excerpt: string;
  body: string;
  category: string;
  tags: string[];
  seo: { metaTitle: string; metaDescription: string };
  topic: {
    keyword: string;
    sourceUrls: string[];
    notes?: string;
    targetProfile?: string;
  };
}

export interface ReviewQueueItem {
  id: string;
  createdAt: string;
  draft: ArticleDraftSummary;
  eyecatch?: { url: string; alt: string };
  review: ReviewResult;
}

export interface ReviewQueueFile {
  items: ReviewQueueItem[];
}
