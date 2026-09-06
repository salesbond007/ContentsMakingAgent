import { describe, expect, it } from "vitest";
import { insertCtas } from "../src/agents/writing.js";

const cta = {
  id: "seminar",
  label: "セミナー",
  url: "https://example.com/seminar",
  buttonText: "申し込む",
  useWhen: "テスト",
};

describe("insertCtas", () => {
  it("CTAが無い場合はプレースホルダーを除去し、フッターも追加しない", () => {
    const body = "<p>導入</p>\n[[CTA_BANNER]]\n<p>課題</p>\n[[CTA_INLINE]]\n<p>まとめ</p>";
    const result = insertCtas(body, undefined);

    expect(result).not.toContain("[[CTA_BANNER]]");
    expect(result).not.toContain("[[CTA_INLINE]]");
    expect(result).not.toContain("cta-footer");
    expect(result).not.toContain(cta.url);
  });

  it("CTAがある場合はバナー・インライン・フッターの3箇所すべてに同じリンクを挿入する", () => {
    const body = "<p>導入</p>\n[[CTA_BANNER]]\n<p>課題</p>\n[[CTA_INLINE]]\n<p>まとめ</p>";
    const result = insertCtas(body, cta);

    expect(result).toContain('class="cta-banner"');
    expect(result).toContain('class="cta-inline"');
    expect(result).toContain('class="cta-footer"');
    expect(result.match(new RegExp(cta.url, "g"))).toHaveLength(3);
    expect(result).not.toContain("[[CTA_BANNER]]");
    expect(result).not.toContain("[[CTA_INLINE]]");
  });

  it("プレースホルダーが本文に無くても、フッターCTAだけは末尾に追加される", () => {
    const body = "<p>プレースホルダーなしの本文</p>";
    const result = insertCtas(body, cta);

    expect(result).toContain('class="cta-footer"');
    expect(result.match(new RegExp(cta.url, "g"))).toHaveLength(1);
  });
});
