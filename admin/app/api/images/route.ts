import { NextRequest, NextResponse } from "next/server";
import { getRepoJsonFile, updateRepoJsonFile } from "@/lib/github";
import { generateId } from "@/lib/id";
import { isTrustedOrigin } from "@/lib/security";
import type { ImageEntry, ImagesFile, ImageUseCase } from "@/lib/types";

export const runtime = "nodejs";

const FILE_PATH = "config/images.json";
const USE_CASES: ImageUseCase[] = ["chart", "seminar", "thumbnail"];

export async function GET() {
  const file = await getRepoJsonFile<ImagesFile>(FILE_PATH);
  return NextResponse.json({ images: file?.data.images ?? [] });
}

export async function POST(request: NextRequest) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 403 });
  }

  const body = (await request.json()) as { title?: string; url?: string; useCase?: string; note?: string };
  const title = body.title?.trim();
  const url = body.url?.trim();
  const useCase = body.useCase as ImageUseCase;
  const note = body.note?.trim();

  if (!title || !url) {
    return NextResponse.json({ error: "タイトル・画像URLはどちらも必須です" }, { status: 400 });
  }
  if (!USE_CASES.includes(useCase)) {
    return NextResponse.json({ error: "使用ケースの指定が不正です" }, { status: 400 });
  }

  const file = await getRepoJsonFile<ImagesFile>(FILE_PATH);
  const existing = file?.data.images ?? [];
  const newImage: ImageEntry = {
    id: generateId(
      existing.map((i) => i.id),
      "image"
    ),
    title,
    url,
    useCase,
    ...(note ? { note } : {}),
  };
  const updated: ImagesFile = { ...(file?.data ?? { images: [] }), images: [...existing, newImage] };

  if (file) {
    await updateRepoJsonFile(FILE_PATH, updated, file.sha, "Add image via admin panel");
  } else {
    return NextResponse.json({ error: `${FILE_PATH} が見つかりません` }, { status: 404 });
  }

  return NextResponse.json({ ok: true, image: newImage });
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

  const file = await getRepoJsonFile<ImagesFile>(FILE_PATH);
  if (!file) {
    return NextResponse.json({ error: `${FILE_PATH} が見つかりません` }, { status: 404 });
  }

  const updated: ImagesFile = { ...file.data, images: file.data.images.filter((i) => i.id !== id) };
  await updateRepoJsonFile(FILE_PATH, updated, file.sha, "Remove image via admin panel");

  return NextResponse.json({ ok: true });
}
