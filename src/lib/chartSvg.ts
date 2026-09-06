import type { FigureSpec } from "../types.js";

const WIDTH = 800;
const HEIGHT = 480;
const PADDING = { top: 60, right: 40, bottom: 80, left: 60 };
const BRAND_COLOR = "#7B1F2B"; // ブランドカラー(ワインレッド)

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 出典等から得た実データをもとに、正確な棒グラフをSVGとして描画する。
 * AI画像生成モデルには数値を正しく描かせられないため、グラフは必ずこの関数でコード側から生成する
 * （FigureSpec.chart に実データが無い場合は呼び出さないこと）。
 * 複数系列の場合は、系列ごとに並べた棒として描画する。
 */
export function renderBarChartSvg(spec: NonNullable<FigureSpec["chart"]>, title: string): string {
  const { labels, series } = spec;
  const chartWidth = WIDTH - PADDING.left - PADDING.right;
  const chartHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const allValues = series.flatMap((s) => s.values);
  const maxValue = Math.max(...allValues, 0) * 1.15 || 1;

  const groupWidth = chartWidth / labels.length;
  const barWidth = (groupWidth * 0.7) / series.length;
  const seriesColors = [BRAND_COLOR, "#B8848C", "#4A4A4A", "#D9A5AC"];

  const bars: string[] = [];
  const xLabels: string[] = [];

  labels.forEach((label, labelIndex) => {
    const groupX = PADDING.left + labelIndex * groupWidth + groupWidth * 0.15;
    series.forEach((s, seriesIndex) => {
      const value = s.values[labelIndex] ?? 0;
      const barHeight = (value / maxValue) * chartHeight;
      const x = groupX + seriesIndex * barWidth;
      const y = PADDING.top + chartHeight - barHeight;
      const color = seriesColors[seriesIndex % seriesColors.length];
      bars.push(
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(barWidth * 0.85).toFixed(1)}" height="${barHeight.toFixed(1)}" fill="${color}" />`
      );
      bars.push(
        `<text x="${(x + barWidth * 0.425).toFixed(1)}" y="${(y - 6).toFixed(1)}" font-size="14" text-anchor="middle" fill="#333">${escapeXml(String(value))}</text>`
      );
    });
    xLabels.push(
      `<text x="${(groupX + (groupWidth * 0.7) / 2).toFixed(1)}" y="${PADDING.top + chartHeight + 24}" font-size="14" text-anchor="middle" fill="#333">${escapeXml(label)}</text>`
    );
  });

  const legend =
    series.length > 1
      ? series
          .map((s, i) => {
            const x = PADDING.left + i * 140;
            const color = seriesColors[i % seriesColors.length];
            return (
              `<rect x="${x}" y="${HEIGHT - 24}" width="14" height="14" fill="${color}" />` +
              `<text x="${x + 20}" y="${HEIGHT - 12}" font-size="13" fill="#333">${escapeXml(s.name)}</text>`
            );
          })
          .join("")
      : "";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">` +
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="#ffffff" />` +
    `<text x="${WIDTH / 2}" y="30" font-size="18" font-weight="bold" text-anchor="middle" fill="#222">${escapeXml(title)}</text>` +
    `<line x1="${PADDING.left}" y1="${PADDING.top + chartHeight}" x2="${WIDTH - PADDING.right}" y2="${PADDING.top + chartHeight}" stroke="#ccc" />` +
    bars.join("") +
    xLabels.join("") +
    legend +
    `</svg>`
  );
}
