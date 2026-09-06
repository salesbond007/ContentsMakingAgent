"use client";

import { useEffect, useState } from "react";
import { generateId } from "@/lib/id";

interface CtaOption {
  id: string;
  label: string;
  url: string;
  buttonText: string;
  useWhen: string;
}

const EMPTY: Omit<CtaOption, "id"> = { label: "", url: "", buttonText: "", useWhen: "" };

export default function CtasPage() {
  const [ctas, setCtas] = useState<CtaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [draft, setDraft] = useState<Omit<CtaOption, "id">>(EMPTY);

  useEffect(() => {
    fetch("/api/ctas")
      .then((r) => r.json())
      .then((data) => setCtas(data.ctas ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function save(next: CtaOption[]) {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/ctas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ctas: next }),
    });
    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMessage({ type: "error", text: body.error ?? "保存に失敗しました" });
      return;
    }

    setCtas(next);
    setMessage({ type: "success", text: "保存しました。次回の記事生成から反映されます。" });
  }

  function addDraft() {
    if (!draft.label || !draft.url || !draft.buttonText) {
      setMessage({ type: "error", text: "表示名・URL・ボタン文言は必須です" });
      return;
    }
    const id = generateId(
      ctas.map((c) => c.id),
      "cta"
    );
    save([...ctas, { ...draft, id }]);
    setDraft(EMPTY);
  }

  function removeCta(id: string) {
    if (!confirm(`CTA「${id}」を削除しますか？`)) return;
    save(ctas.filter((c) => c.id !== id));
  }

  if (loading) return <p>読み込み中...</p>;

  return (
    <div>
      {message && <div className={`message ${message.type}`}>{message.text}</div>}

      {ctas.length === 0 && (
        <div className="card">
          <p style={{ margin: 0 }}>登録されているCTAはありません。記事にはCTAが挿入されません。</p>
        </div>
      )}

      {ctas.map((cta) => (
        <div className="item" key={cta.id}>
          <div className="item-header">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <strong style={{ fontSize: 16 }}>{cta.label}</strong>
              <span className="badge">{cta.id}</span>
            </div>
            <button className="danger" onClick={() => removeCta(cta.id)} disabled={saving}>
              削除
            </button>
          </div>
          <div className="cta-detail-grid">
            <span className="cta-detail-label">URL</span>
            <a href={cta.url} target="_blank" rel="noreferrer" className="cta-url-chip">{cta.url}</a>
            <span className="cta-detail-label">ボタン文言</span>
            <span>{cta.buttonText}</span>
            <span className="cta-detail-label">使う場面</span>
            <span>{cta.useWhen}</span>
          </div>
        </div>
      ))}

      <div className="card">
        <h3>新しいCTAを追加</h3>
        <p style={{ marginTop: 0 }}>id(管理用の識別子)は保存時に自動採番されます。</p>

        <label>表示名</label>
        <input type="text" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="例: 生成AI導入事例の関連記事" />

        <label>URL(実在するもののみ)</label>
        <input type="text" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://..." />

        <label>ボタン文言</label>
        <input type="text" value={draft.buttonText} onChange={(e) => setDraft({ ...draft, buttonText: e.target.value })} placeholder="例: あわせて読みたい記事はこちら" />

        <label>使う場面(AIが選ぶ判断材料になる説明文)</label>
        <textarea value={draft.useWhen} onChange={(e) => setDraft({ ...draft, useWhen: e.target.value })} placeholder="例: 生成AIの導入事例に関する記事" />

        <button onClick={addDraft} disabled={saving}>
          {saving ? "保存中..." : "追加する"}
        </button>
      </div>
    </div>
  );
}
