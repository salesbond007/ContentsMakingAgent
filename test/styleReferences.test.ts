import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadStyleReferences } from "../src/clients/styleReferences.js";

describe("loadStyleReferences", () => {
  const tmpFiles: string[] = [];

  afterEach(() => {
    for (const f of tmpFiles.splice(0)) fs.rmSync(f, { force: true });
  });

  it("ファイルが存在しない場合は空配列を返す", () => {
    expect(loadStyleReferences("this-file-does-not-exist.json")).toEqual([]);
  });

  it("登録された参考記事の一覧を読み込む", () => {
    const tmp = path.join(os.tmpdir(), `style-references-${Date.now()}.json`);
    fs.writeFileSync(
      tmp,
      JSON.stringify({
        references: [{ label: "参考A", url: "https://example.com/a", note: "落ち着いたトーン" }],
      })
    );
    tmpFiles.push(tmp);

    const refs = loadStyleReferences(tmp);
    expect(refs).toHaveLength(1);
    expect(refs[0].url).toBe("https://example.com/a");
  });

  it("不正なJSONの場合は空配列にフォールバックする", () => {
    const tmp = path.join(os.tmpdir(), `style-references-broken-${Date.now()}.json`);
    fs.writeFileSync(tmp, "{ not valid json");
    tmpFiles.push(tmp);

    expect(loadStyleReferences(tmp)).toEqual([]);
  });
});
