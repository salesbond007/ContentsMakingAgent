import { describe, expect, it } from "vitest";
import { findNgWordHits } from "../src/clients/ngWords.js";

describe("findNgWordHits", () => {
  it("本文中に含まれるNGワードを検出する", () => {
    const hits = findNgWordHits("<p>この方法なら絶対に成功します。</p>", ["絶対に", "保証"]);
    expect(hits).toEqual(["絶対に"]);
  });

  it("該当するNGワードが無ければ空配列を返す", () => {
    const hits = findNgWordHits("<p>落ち着いたトーンで説明します。</p>", ["絶対に", "保証"]);
    expect(hits).toEqual([]);
  });
});
