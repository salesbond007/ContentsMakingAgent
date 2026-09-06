import { NextRequest, NextResponse } from "next/server";
import { getRepoJsonFile, updateRepoJsonFile } from "@/lib/github";
import { generateId } from "@/lib/id";
import { isTrustedOrigin } from "@/lib/security";
import type { ReferenceMaterial, ReferenceMaterialsFile, ReferenceMaterialType } from "@/lib/types";

export const runtime = "nodejs";

const FILE_PATH = "config/reference-materials.json";
const TYPES: ReferenceMaterialType[] = ["style", "service"];

export async function GET() {
  const file = await getRepoJsonFile<ReferenceMaterialsFile>(FILE_PATH);
  return NextResponse.json({ materials: file?.data.materials ?? [] });
}

export async function POST(request: NextRequest) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 403 });
  }

  const body = (await request.json()) as {
    type?: string;
    label?: string;
    urls?: string[];
    memo?: string;
  };
  const type = body.type as ReferenceMaterialType;
  const label = body.label?.trim();
  const urls = Array.isArray(body.urls) ? body.urls.map((u) => u.trim()).filter(Boolean) : [];
  const memo = body.memo?.trim() ?? "";

  if (!TYPES.includes(type)) {
    return NextResponse.json({ error: "種別の指定が不正です" }, { status: 400 });
  }
  if (!label) {
    return NextResponse.json({ error: "表示名は必須です" }, { status: 400 });
  }
  if (urls.length === 0 && !memo) {
    return NextResponse.json({ error: "URLまたはメモのどちらかは入力してください" }, { status: 400 });
  }

  const file = await getRepoJsonFile<ReferenceMaterialsFile>(FILE_PATH);
  const existing = file?.data.materials ?? [];
  const newMaterial: ReferenceMaterial = {
    id: generateId(
      existing.map((m) => m.id),
      "ref"
    ),
    type,
    label,
    urls,
    memo,
  };
  const updated: ReferenceMaterialsFile = {
    ...(file?.data ?? { materials: [] }),
    materials: [...existing, newMaterial],
  };

  if (file) {
    await updateRepoJsonFile(FILE_PATH, updated, file.sha, "Add reference material via admin panel");
  } else {
    return NextResponse.json({ error: `${FILE_PATH} が見つかりません` }, { status: 404 });
  }

  return NextResponse.json({ ok: true, material: newMaterial });
}

export async function DELETE(request: NextRequest) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "idを指定してください" }, { status: 400 });
  }

  const file = await getRepoJsonFile<ReferenceMaterialsFile>(FILE_PATH);
  if (!file) {
    return NextResponse.json({ error: `${FILE_PATH} が見つかりません` }, { status: 404 });
  }

  const updated: ReferenceMaterialsFile = {
    ...file.data,
    materials: file.data.materials.filter((m) => m.id !== id),
  };
  await updateRepoJsonFile(FILE_PATH, updated, file.sha, "Remove reference material via admin panel");

  return NextResponse.json({ ok: true });
}
