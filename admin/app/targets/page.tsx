"use client";

import { useEffect, useState } from "react";
import type { TargetProfile } from "@/lib/types";

export default function TargetsPage() {
  const [targets, setTargets] = useState<TargetProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");

  function load() {
    return fetch("/api/targets")
      .then((r) => r.json())
      .then((data) => setTargets(data.targets ?? []));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function addTarget() {
    if (!label || !description) {
      setMessage({ type: "error", text: "タイトル・ターゲット属性の説明はどちらも必須です" });
      return;
    }
    setSaving(true);
    setMessage(null);

    const res = await fetch("/api/targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, description }),
    });
    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMessage({ type: "error", text: body.error ?? "保存に失敗しました" });
      return;
    }

    setLabel("");
    setDescription("");
    setMessage({ type: "success", text: "保存しました。次回の記事生成から選択できます。" });
    await load();
  }

  async function removeTarget(id: string, targetLabel: string) {
    if (!confirm(`ターゲット「${targetLabel}」を削除しますか？`)) return;
    setSaving(true);
    setMessage(null);

    const res = await fetch(`/api/targets?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMessage({ type: "error", text: body.error ?? "削除に失敗しました" });
      return;
    }

    await load();
  }

  if (loading) return <p>読み込み中...</p>;

  return (
    <div>
      {message && <div className={`message ${message.type}`}>{message.text}</div>}

      {targets.length === 0 && (
        <div className="card">
          <p style={{ margin: 0 }}>登録されているターゲットプロフィールはありません。</p>
        </div>
      )}

      {targets.map((t) => (
        <div className="item" key={t.id}>
          <div className="item-header">
            <strong>{t.label}</strong>
            <button className="danger" onClick={() => removeTarget(t.id, t.label)} disabled={saving}>
              削除
            </button>
          </div>
          <p style={{ margin: "6px 0" }}>{t.description}</p>
        </div>
      ))}

      <div className="card">
        <h3>新しいターゲットを追加</h3>
        <label>タイトル</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="例: 中小企業の経営者層"
        />

        <label>ターゲット属性(自由記述)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="例: 従業員数50名以下の中小企業の経営者・役員。ITリテラシーは高くないため専門用語を避け、費用対効果を重視する"
        />

        <button onClick={addTarget} disabled={saving}>
          {saving ? "保存中..." : "追加する"}
        </button>
      </div>
    </div>
  );
}
