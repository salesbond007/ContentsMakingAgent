import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, afterAll } from "vitest";
import { loadReferenceMaterials } from "../src/clients/referenceMaterials.js";

const tmpFiles: string[] = [];

afterAll(() => {
  for (const f of tmpFiles) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
});

describe("loadReferenceMaterials", () => {
  it("ファイルが存在しない場合は空配列を返す", () => {
    const filePath = path.join(os.tmpdir(), `reference-materials-missing-${Date.now()}.json`);
    expect(loadReferenceMaterials(filePath)).toEqual([]);
  });

  it("不正なJSONの場合は空配列にフォールバックする", () => {
    const filePath = path.join(os.tmpdir(), `reference-materials-broken-${Date.now()}.json`);
    fs.writeFileSync(filePath, "{not json");
    tmpFiles.push(filePath);
    expect(loadReferenceMaterials(filePath)).toEqual([]);
  });

  it("style/serviceの種別・複数URL・メモを含む一覧を読み込める", () => {
    const filePath = path.join(os.tmpdir(), `reference-materials-ok-${Date.now()}.json`);
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        materials: [
          { id: "m1", type: "style", label: "参考記事A", urls: ["https://example.com/a"], memo: "落ち着いたトーン" },
          {
            id: "m2",
            type: "service",
            label: "自社サービスX",
            urls: ["https://example.com/lp1", "https://example.com/lp2"],
            memo: "月額プランあり",
          },
        ],
      })
    );
    tmpFiles.push(filePath);

    const materials = loadReferenceMaterials(filePath);
    expect(materials).toHaveLength(2);
    expect(materials[1].urls).toEqual(["https://example.com/lp1", "https://example.com/lp2"]);
  });
});
