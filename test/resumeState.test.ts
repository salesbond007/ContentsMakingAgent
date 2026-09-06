import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, afterAll } from "vitest";
import { clearResumeState, loadResumeState, saveResumeState } from "../src/clients/resumeState.js";

const tmpFiles: string[] = [];

afterAll(() => {
  for (const f of tmpFiles) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
});

function tmpPath(name: string): string {
  const p = path.join(os.tmpdir(), `${name}-${Date.now()}-${Math.random()}.json`);
  tmpFiles.push(p);
  return p;
}

describe("resumeState", () => {
  it("ファイルが存在しない場合はnullを返す", () => {
    expect(loadResumeState(tmpPath("resume-missing"))).toBeNull();
  });

  it("保存した中断状態を読み込める", () => {
    const filePath = tmpPath("resume-ok");
    saveResumeState(
      {
        interruptedOn: "2026-01-01",
        completedCount: 2,
        remainingTopics: [{ keyword: "続きのキーワード", sourceUrls: [], source: "trend" }],
      },
      filePath
    );

    const state = loadResumeState(filePath);
    expect(state?.completedCount).toBe(2);
    expect(state?.remainingTopics).toHaveLength(1);
  });

  it("消去すると再開情報として扱われなくなる(空オブジェクトで上書き)", () => {
    const filePath = tmpPath("resume-clear");
    saveResumeState(
      { interruptedOn: "2026-01-01", completedCount: 1, remainingTopics: [{ keyword: "a", sourceUrls: [], source: "trend" }] },
      filePath
    );
    clearResumeState(filePath);
    expect(loadResumeState(filePath)).toBeNull();
    expect(fs.existsSync(filePath)).toBe(true);
  });
});
