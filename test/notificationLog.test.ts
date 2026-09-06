import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { appendPendingNotification, readAndClearPendingNotifications } from "../src/clients/notificationLog.js";

describe("notificationLog", () => {
  const tmpFiles: string[] = [];

  afterEach(() => {
    for (const f of tmpFiles.splice(0)) fs.rmSync(f, { force: true });
  });

  it("追加した通知が蓄積され、読み出すとファイルが空になる", () => {
    const tmp = path.join(os.tmpdir(), `pending-notifications-${Date.now()}.json`);
    tmpFiles.push(tmp);

    appendPendingNotification("記事A: 公開しました", tmp);
    appendPendingNotification("記事B: 下書きに入れました", tmp);

    const pending = readAndClearPendingNotifications(tmp);
    expect(pending).toEqual(["記事A: 公開しました", "記事B: 下書きに入れました"]);

    const clearedAgain = readAndClearPendingNotifications(tmp);
    expect(clearedAgain).toEqual([]);
  });

  it("ファイルが存在しない場合は空配列を返す", () => {
    const tmp = path.join(os.tmpdir(), `pending-notifications-missing-${Date.now()}.json`);
    tmpFiles.push(tmp);

    const pending = readAndClearPendingNotifications(tmp);
    expect(pending).toEqual([]);
  });
});
