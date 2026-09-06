import { NextResponse } from "next/server";
import { getPublishedAtDates } from "@/lib/microcms";

export const runtime = "nodejs";

function toDateKey(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD (microCMSのpublishedAtはISO 8601)
}

export async function GET() {
  let dates: string[];
  let totalCount: number;
  try {
    ({ dates, totalCount } = await getPublishedAtDates(500));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "microCMSからの取得に失敗しました" },
      { status: 500 }
    );
  }

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  const today = dates.filter((d) => now - new Date(d).getTime() < DAY_MS).length;
  const last7Days = dates.filter((d) => now - new Date(d).getTime() < 7 * DAY_MS).length;
  const last30Days = dates.filter((d) => now - new Date(d).getTime() < 30 * DAY_MS).length;

  // 直近14日の日次件数(手動作成分もmicroCMSの公開記事である限り区別なく含まれる)。
  const dailyCounts: { date: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const key = toDateKey(new Date(now - i * DAY_MS).toISOString());
    dailyCounts.push({ date: key, count: dates.filter((d) => toDateKey(d) === key).length });
  }

  // 直近6ヶ月の月次件数。
  const monthlyCounts: { month: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const target = new Date(now);
    target.setDate(1);
    target.setMonth(target.getMonth() - i);
    const key = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
    monthlyCounts.push({ month: key, count: dates.filter((d) => toDateKey(d).startsWith(key)).length });
  }

  return NextResponse.json({
    today,
    last7Days,
    last30Days,
    totalPublished: totalCount,
    dailyCounts,
    monthlyCounts,
  });
}
