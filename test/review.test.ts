import { describe, expect, it } from "vitest";
import { decideVerdict } from "../src/agents/review.js";

const thresholds = { REVIEW_AUTO_PUBLISH_THRESHOLD: 80, REVIEW_NEEDS_CHECK_THRESHOLD: 60 };

describe("decideVerdict", () => {
  it("合計80点以上は自動公開", () => {
    const { total, verdict } = decideVerdict(
      { factCheck: 22, riskExpression: 20, brandToneManner: 20, plagiarismDuplication: 20 },
      thresholds
    );
    expect(total).toBe(82);
    expect(verdict).toBe("auto-publish");
  });

  it("境界値80点はちょうど自動公開", () => {
    const { verdict } = decideVerdict(
      { factCheck: 20, riskExpression: 20, brandToneManner: 20, plagiarismDuplication: 20 },
      thresholds
    );
    expect(verdict).toBe("auto-publish");
  });

  it("60〜79点は要確認", () => {
    const { verdict } = decideVerdict(
      { factCheck: 15, riskExpression: 15, brandToneManner: 15, plagiarismDuplication: 15 },
      thresholds
    );
    expect(verdict).toBe("needs-review");
  });

  it("境界値60点はちょうど要確認", () => {
    const { verdict } = decideVerdict(
      { factCheck: 15, riskExpression: 15, brandToneManner: 15, plagiarismDuplication: 15 },
      thresholds
    );
    expect(verdict).toBe("needs-review");
  });

  it("60点未満は差し戻し", () => {
    const { verdict } = decideVerdict(
      { factCheck: 10, riskExpression: 10, brandToneManner: 10, plagiarismDuplication: 10 },
      thresholds
    );
    expect(verdict).toBe("rejected");
  });
});
