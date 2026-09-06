import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),

  MICROCMS_SERVICE_DOMAIN: z.string().min(1, "MICROCMS_SERVICE_DOMAIN is required"),
  MICROCMS_API_KEY: z.string().min(1, "MICROCMS_API_KEY is required"),
  MICROCMS_ARTICLES_ENDPOINT: z.string().default("articles"),
  MICROCMS_KEYWORDS_ENDPOINT: z.string().default("keywords"),
  MICROCMS_FIELD_MAP_PATH: z.string().optional(),
  CTA_CONFIG_PATH: z.string().optional(),
  REFERENCE_MATERIALS_PATH: z.string().optional(),
  NG_WORDS_PATH: z.string().optional(),
  SITE_CONFIG_PATH: z.string().optional(),
  IMAGE_LIBRARY_PATH: z.string().optional(),
  GLOBAL_SETTINGS_PATH: z.string().optional(),
  DAILY_STATS_PATH: z.string().optional(),
  REWRITE_THRESHOLD_DAYS: z.coerce.number().int().positive().default(90),
  REVIEW_QUEUE_PATH: z.string().optional(),

  SLACK_WEBHOOK_URL: z.string().url().optional(),

  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  GOOGLE_DRIVE_FOLDER_ID: z.string().optional(),

  COMPETITOR_RSS_FEEDS: z.string().optional(),

  // 0を指定すると自動生成を行わない(手動生成のみで運用したい場合に使う)。
  DAILY_ARTICLE_COUNT: z.coerce.number().int().nonnegative().default(3),
  REVIEW_AUTO_PUBLISH_THRESHOLD: z.coerce.number().int().min(0).max(100).default(80),
  REVIEW_NEEDS_CHECK_THRESHOLD: z.coerce.number().int().min(0).max(100).default(60),
  PUBLISH_TARGET_NAME: z.string().default("BondAIメディア"),

  // --- 手動実行(workflow_dispatch)専用。両方とも未指定なら通常の自動実行になる ---
  MANUAL_KEYWORD: z.string().optional(),
  MANUAL_CTA_ID: z.string().optional(),
  MANUAL_SOURCE_URLS: z.string().optional(),
  MANUAL_NOTES: z.string().optional(),
  MANUAL_TARGET: z.string().optional(),

  // --- 承認済み記事の反映(publishApproved.ts)専用 ---
  MANUAL_QUEUE_ID: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function loadConfig(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`環境変数の検証に失敗しました:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function competitorFeeds(env: Env): string[] {
  return (env.COMPETITOR_RSS_FEEDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
