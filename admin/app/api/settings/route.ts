import { NextRequest, NextResponse } from "next/server";
import { getRepoVariable, setRepoVariable } from "@/lib/github";

export const runtime = "nodejs";

const DEFAULTS = {
  DAILY_ARTICLE_COUNT: "3",
  DAILY_API_CALL_CAP: "4",
};

export async function GET() {
  const [dailyArticleCount, dailyApiCallCap, pipelinePaused] = await Promise.all([
    getRepoVariable("DAILY_ARTICLE_COUNT"),
    getRepoVariable("DAILY_API_CALL_CAP"),
    getRepoVariable("PIPELINE_PAUSED"),
  ]);

  return NextResponse.json({
    dailyArticleCount: dailyArticleCount ?? DEFAULTS.DAILY_ARTICLE_COUNT,
    dailyApiCallCap: dailyApiCallCap ?? DEFAULTS.DAILY_API_CALL_CAP,
    paused: pipelinePaused === "true",
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { dailyArticleCount?: string; dailyApiCallCap?: string };

  const articleCount = Number(body.dailyArticleCount);
  const apiCallCap = Number(body.dailyApiCallCap);

  if (!Number.isInteger(articleCount) || articleCount < 1 || articleCount > 20) {
    return NextResponse.json({ error: "1日の記事数は1〜20の整数で指定してください" }, { status: 400 });
  }
  if (!Number.isInteger(apiCallCap) || apiCallCap < 1 || apiCallCap > 20) {
    return NextResponse.json({ error: "コスト上限は1〜20の整数で指定してください" }, { status: 400 });
  }

  await setRepoVariable("DAILY_ARTICLE_COUNT", String(articleCount));
  await setRepoVariable("DAILY_API_CALL_CAP", String(apiCallCap));

  return NextResponse.json({ ok: true });
}
