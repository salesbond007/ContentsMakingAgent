import { NextResponse } from "next/server";
import { getRepoJsonFile } from "@/lib/github";
import type { ReviewQueueFile } from "@/lib/types";

export const runtime = "nodejs";

const FILE_PATH = "data/manual-review-queue.json";

export async function GET() {
  const file = await getRepoJsonFile<ReviewQueueFile>(FILE_PATH);
  const items = (file?.data.items ?? []).slice().reverse(); // 新しい順
  return NextResponse.json({ items });
}
