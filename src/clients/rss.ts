import Parser from "rss-parser";
import { logger } from "../lib/logger.js";

export interface RssItem {
  title: string;
  link: string;
}

export async function fetchRssItems(feedUrls: string[], perFeedLimit = 5): Promise<RssItem[]> {
  const parser = new Parser();
  const items: RssItem[] = [];

  for (const url of feedUrls) {
    try {
      const feed = await parser.parseURL(url);
      for (const item of (feed.items ?? []).slice(0, perFeedLimit)) {
        if (item.title && item.link) {
          items.push({ title: item.title, link: item.link });
        }
      }
    } catch (err) {
      logger.warn("RSS取得に失敗しました", {
        url,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return items;
}
