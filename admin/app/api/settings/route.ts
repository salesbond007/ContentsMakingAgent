import { NextRequest, NextResponse } from "next/server";
import { getRepoVariable, setRepoVariable } from "@/lib/github";
import { isTrustedOrigin } from "@/lib/security";

export const runtime = "nodejs";

const DEFAULTS = {
  DAILY_ARTICLE_COUNT: "3",
};

export async function GET() {
  try {
    const dailyArticleCount = await getRepoVariable("DAILY_ARTICLE_COUNT");

    return NextResponse.json({
      dailyArticleCount: dailyArticleCount ?? DEFAULTS.DAILY_ARTICLE_COUNT,
    });
  } catch (err) {
    return NextResponse.json(
      {
        dailyArticleCount: DEFAULTS.DAILY_ARTICLE_COUNT,
        error: err instanceof Error ? err.message : "取得に失敗しました",
      },
      { status: 200 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 403 });
  }

  const body = (await request.json()) as { dailyArticleCount?: string };

  const articleCount = Number(body.dailyArticleCount);

  // 0 = 自動生成なし(手動生成のみ運用したい場合に使う)。
  if (!Number.isInteger(articleCount) || articleCount < 0 || articleCount > 100) {
    return NextResponse.json({ error: "1日の記事数は0〜100の整数で指定してください(0で自動生成なし)" }, { status: 400 });
  }

  try {
    await setRepoVariable("DAILY_ARTICLE_COUNT", String(articleCount));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "保存に失敗しました" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
