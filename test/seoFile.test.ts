import { describe, expect, it } from "vitest";
import { toSeoFileName, truncateAltText } from "../src/lib/seoFile.js";

describe("toSeoFileName", () => {
  it("タイトルからスラッグ化したファイル名を作る", () => {
    const fileName = toSeoFileName("生成AIによる契約書レビュー自動化", "eyecatch", "png");
    expect(fileName).toMatch(/^生成aiによる契約書レビュー自動化-eyecatch-\d+\.png$/);
  });

  it("タイトルが空の場合はデフォルト名にフォールバックする", () => {
    const fileName = toSeoFileName("!!!", "eyecatch", "png");
    expect(fileName).toMatch(/^bondai-media-eyecatch-\d+\.png$/);
  });
});

describe("truncateAltText", () => {
  it("上限より短い場合はそのまま返す", () => {
    expect(truncateAltText("短いテキスト", 10)).toBe("短いテキスト");
  });

  it("上限を超える場合は省略記号付きで切り詰める", () => {
    const result = truncateAltText("a".repeat(20), 10);
    expect(result.length).toBe(10);
    expect(result.endsWith("…")).toBe(true);
  });
});
