import { describe, expect, it } from "vitest";
import { renderBarChartSvg } from "../src/lib/chartSvg.js";

describe("renderBarChartSvg", () => {
  it("有効なSVGを生成し、実際の数値をそのまま反映する", () => {
    const svg = renderBarChartSvg(
      { labels: ["導入前", "導入後"], series: [{ name: "対応時間(分)", values: [45, 12] }] },
      "問い合わせ対応時間の変化"
    );

    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("問い合わせ対応時間の変化");
    expect(svg).toContain(">45<");
    expect(svg).toContain(">12<");
    expect(svg).toContain("導入前");
    expect(svg).toContain("導入後");
  });

  it("HTMLとして危険な文字をエスケープする", () => {
    const svg = renderBarChartSvg(
      { labels: ["<script>"], series: [{ name: "A&B", values: [1] }] },
      "テスト\"タイトル\""
    );

    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });

  it("複数系列の場合は凡例を含める", () => {
    const svg = renderBarChartSvg(
      {
        labels: ["Q1", "Q2"],
        series: [
          { name: "自社", values: [10, 20] },
          { name: "競合平均", values: [8, 15] },
        ],
      },
      "比較"
    );

    expect(svg).toContain("自社");
    expect(svg).toContain("競合平均");
  });
});
