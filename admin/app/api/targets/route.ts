import { NextRequest, NextResponse } from "next/server";
import { getRepoJsonFile, updateRepoJsonFile } from "@/lib/github";
import { generateId } from "@/lib/id";
import { isTrustedOrigin } from "@/lib/security";
import type { TargetProfile, TargetsFile } from "@/lib/types";

export const runtime = "nodejs";

const FILE_PATH = "config/targets.json";

export async function GET() {
  const file = await getRepoJsonFile<TargetsFile>(FILE_PATH);
  return NextResponse.json({ targets: file?.data.targets ?? [] });
}

/** 新規追加1件を受け取り、idを自動採番して既存一覧に追加する。 */
export async function POST(request: NextRequest) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 403 });
  }

  const body = (await request.json()) as { label?: string; description?: string };
  const label = body.label?.trim();
  const description = body.description?.trim();

  if (!label || !description) {
    return NextResponse.json({ error: "タイトル・ターゲット属性の説明はどちらも必須です" }, { status: 400 });
  }

  const file = await getRepoJsonFile<TargetsFile>(FILE_PATH);
  const existing = file?.data.targets ?? [];
  const newTarget: TargetProfile = {
    id: generateId(
      existing.map((t) => t.id),
      "target"
    ),
    label,
    description,
  };
  const updated: TargetsFile = { ...(file?.data ?? { targets: [] }), targets: [...existing, newTarget] };

  if (file) {
    await updateRepoJsonFile(FILE_PATH, updated, file.sha, "Add target profile via admin panel");
  } else {
    return NextResponse.json({ error: `${FILE_PATH} が見つかりません` }, { status: 404 });
  }

  return NextResponse.json({ ok: true, target: newTarget });
}

/** idを指定して1件削除する。 */
export async function DELETE(request: NextRequest) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "idを指定してください" }, { status: 400 });
  }

  const file = await getRepoJsonFile<TargetsFile>(FILE_PATH);
  if (!file) {
    return NextResponse.json({ error: `${FILE_PATH} が見つかりません` }, { status: 404 });
  }

  const updated: TargetsFile = { ...file.data, targets: file.data.targets.filter((t) => t.id !== id) };
  await updateRepoJsonFile(FILE_PATH, updated, file.sha, "Remove target profile via admin panel");

  return NextResponse.json({ ok: true });
}
