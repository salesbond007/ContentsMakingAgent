import { describe, expect, it } from "vitest";
import { isBillingError } from "../src/lib/billingError.js";

describe("isBillingError", () => {
  it("Anthropicの残高不足メッセージを検出する", () => {
    const err = new Error("Your credit balance is too low to access the Anthropic API.");
    expect(isBillingError(err)).toBe(true);
  });

  it("OpenAIのinsufficient_quotaを検出する", () => {
    const err = Object.assign(new Error("You exceeded your current quota, please check your plan and billing details."), {
      status: 429,
    });
    expect(isBillingError(err)).toBe(true);
  });

  it("status 402(Payment Required)を検出する", () => {
    const err = Object.assign(new Error("payment required"), { status: 402 });
    expect(isBillingError(err)).toBe(true);
  });

  it("通常のエラーは残高不足と判定しない", () => {
    expect(isBillingError(new Error("network timeout"))).toBe(false);
    expect(isBillingError(Object.assign(new Error("rate limited"), { status: 429 }))).toBe(false);
  });

  it("非オブジェクト・null等は安全にfalseを返す", () => {
    expect(isBillingError(null)).toBe(false);
    expect(isBillingError(undefined)).toBe(false);
    expect(isBillingError("string error")).toBe(false);
  });
});
