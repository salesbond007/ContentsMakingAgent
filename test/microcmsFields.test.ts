import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadFieldMaps } from "../src/clients/microcmsFields.js";

describe("loadFieldMaps", () => {
  const tmpFiles: string[] = [];

  afterEach(() => {
    for (const f of tmpFiles.splice(0)) fs.rmSync(f, { force: true });
  });

  it("ファイルが存在しない場合はデフォルトのフィールド名を返す", () => {
    const maps = loadFieldMaps("this-file-does-not-exist.json");
    expect(maps.articles.title).toBe("title");
    expect(maps.keywords.usedAt).toBe("usedAt");
  });

  it("一部のフィールドだけ上書きされたJSONを、デフォルトとマージする", () => {
    const tmp = path.join(os.tmpdir(), `microcms-fields-${Date.now()}.json`);
    fs.writeFileSync(
      tmp,
      JSON.stringify({
        articles: { title: "articleTitle" },
        keywords: { usedAt: "usedDate" },
      })
    );
    tmpFiles.push(tmp);

    const maps = loadFieldMaps(tmp);
    expect(maps.articles.title).toBe("articleTitle");
    expect(maps.articles.body).toBe("body"); // 上書きしていないフィールドはデフォルトのまま
    expect(maps.keywords.usedAt).toBe("usedDate");
    expect(maps.keywords.keyword).toBe("keyword");
  });

  it("不正なJSONの場合はデフォルトのフィールド名にフォールバックする", () => {
    const tmp = path.join(os.tmpdir(), `microcms-fields-broken-${Date.now()}.json`);
    fs.writeFileSync(tmp, "{ not valid json");
    tmpFiles.push(tmp);

    const maps = loadFieldMaps(tmp);
    expect(maps.articles.title).toBe("title");
  });
});
