"use client";

import { useEffect, useState } from "react";

interface AnalyticsData {
  today: number;
  last7Days: number;
  last30Days: number;
  totalPublished: number;
  dailyCounts: { date: string; count: number }[];
  monthlyCounts: { month: string; count: number }[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "取得に失敗しました");
        setData(body);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "取得に失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>読み込み中...</p>;
  if (error) {
    return (
      <div className="card">
        <div className="message error">{error}</div>
        <p style={{ marginBottom: 0 }}>
          管理画面のGitHub PATが持つ権限とは別に、microCMS読み取り用の環境変数
          (<code>MICROCMS_SERVICE_DOMAIN</code> / <code>MICROCMS_API_KEY</code> /{" "}
          <code>MICROCMS_ARTICLES_ENDPOINT</code>)がVercelに設定されているか確認してください。
        </p>
      </div>
    );
  }
  if (!data) return null;

  const dailyMax = Math.max(1, ...data.dailyCounts.map((d) => d.count));
  const monthlyMax = Math.max(1, ...data.monthlyCounts.map((m) => m.count));

  return (
    <div>
      <div className="stat-grid">
        <StatCard label="本日の公開数" value={data.today} />
        <StatCard label="過去7日間" value={data.last7Days} />
        <StatCard label="過去30日間" value={data.last30Days} />
        <StatCard label="累計公開数" value={data.totalPublished} />
      </div>

      <div className="card">
        <h2>日次コンテンツ追加数(過去14日・公開ベース)</h2>
        <BarList
          items={data.dailyCounts.map((d) => ({ label: d.date.slice(5), value: d.count }))}
          max={dailyMax}
        />
      </div>

      <div className="card">
        <h2>月次コンテンツ追加数(過去6ヶ月・公開ベース)</h2>
        <BarList items={data.monthlyCounts.map((m) => ({ label: m.month, value: m.count }))} max={monthlyMax} />
      </div>

      <div className="card">
        <h2>今後追加予定</h2>
        <p style={{ marginBottom: 0 }}>
          クリック数・PV等のアクセス解析は優先度が低いため後回しにしています(要望があれば追加します)。
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function BarList({ items, max }: { items: { label: string; value: number }[]; max: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((item) => (
        <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <span style={{ width: 56, color: "var(--muted)", flexShrink: 0 }}>{item.label}</span>
          <div style={{ flex: 1, background: "var(--brand-light)", overflow: "hidden" }}>
            <div
              style={{
                width: `${(item.value / max) * 100}%`,
                background: "var(--brand)",
                height: 16,
                minWidth: item.value > 0 ? 4 : 0,
              }}
            />
          </div>
          <span style={{ width: 24, textAlign: "right", flexShrink: 0 }}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}
