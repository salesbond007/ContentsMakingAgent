/**
 * 記事タイトルからSEOを意識したファイル名を作る(画像alt/ファイル名QAの一環)。
 * 日本語タイトルはローマ字化までは行わず、記号除去のうえハッシュ的なタイムスタンプと
 * 組み合わせることで、少なくとも「画像1.png」のような無意味な名前になることは避ける。
 */
export function toSeoFileName(title: string, suffix: string, extension: string): string {
  const slug = title
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .toLowerCase();

  const base = slug || "bondai-media";
  return `${base}-${suffix}-${Date.now()}.${extension}`;
}

/** altテキストが長すぎる場合に適切な長さへ丸める(SEO/アクセシビリティ上、簡潔さが望ましい)。 */
export function truncateAltText(text: string, maxLength = 125): string {
  const trimmed = text.trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}…` : trimmed;
}
