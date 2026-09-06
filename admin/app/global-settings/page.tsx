"use client";

import { useEffect, useState } from "react";

export default function GlobalSettingsPage() {
  const [mustNotViolate, setMustNotViolate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/global-settings")
      .then((r) => r.json())
      .then((data) => setMustNotViolate(data.mustNotViolate ?? ""))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const res = await fetch("/api/global-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mustNotViolate }),
    });
    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMessage({ type: "error", text: body.error ?? "保存に失敗しました" });
      return;
    }

    setMessage({ type: "success", text: "保存しました。次回の記事生成(自動・手動とも)から反映されます。" });
  }

  if (loading) return <p>読み込み中...</p>;

  return (
    <div>
      <div className="card">
        <p style={{ marginTop: 0 }}>
          ここに書いた内容は、自動生成・手動生成を問わず<strong>すべての記事生成が絶対に違反してはならない
          最優先ルール</strong>としてAIに渡されます。例えば「製造業のAI初心者向けに書く」と設定した場合、
          その前提から絶対にずれた記事(専門家向け、別業界向け等)を生成しません。査読エージェントもこの設定に
          違反していないかを必ずチェックします。
        </p>
        <p style={{ marginBottom: 0 }}>空欄のまま保存すると、制約なしで生成します。</p>
      </div>

      <form onSubmit={handleSubmit} className="card">
        <h2>全体設定</h2>
        <label>この設定は自動生成で絶対に違反してはならない(複数行可)</label>
        <textarea
          value={mustNotViolate}
          onChange={(e) => setMustNotViolate(e.target.value)}
          placeholder="例: 製造業のAI初心者向けに書く。専門用語には必ず簡単な説明を添える。読者は経営層〜現場責任者を想定する。"
          style={{ minHeight: 140 }}
        />

        {message && <div className={`message ${message.type}`}>{message.text}</div>}

        <button type="submit" disabled={saving}>
          {saving ? "保存中..." : "保存する"}
        </button>
      </form>
    </div>
  );
}
