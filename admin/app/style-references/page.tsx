"use client";

import { useEffect, useState } from "react";

interface StyleReference {
  label: string;
  url: string;
  note: string;
}

const EMPTY: StyleReference = { label: "", url: "", note: "" };

export default function StyleReferencesPage() {
  const [references, setReferences] = useState<StyleReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [draft, setDraft] = useState<StyleReference>(EMPTY);

  useEffect(() => {
    fetch("/api/style-references")
      .then((r) => r.json())
      .then((data) => setReferences(data.references ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function save(next: StyleReference[]) {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/style-references", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ references: next }),
    });
    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMessage({ type: "error", text: body.error ?? "保存に失敗しました" });
      return;
    }

    setReferences(next);
    setMessage({ type: "success", text: "保存しました。次回の記事生成から反映されます。" });
  }

  function addDraft() {
    if (!draft.label || !draft.url) {
      setMessage({ type: "error", text: "表示名・URLは必須です" });
      return;
    }
    save([...references, draft]);
    setDraft(EMPTY);
  }

  function removeReference(index: number) {
    if (!confirm(`「${references[index].label}」を削除しますか？`)) return;
    save(references.filter((_, i) => i !== index));
  }

  if (loading) return <p>読み込み中...</p>;

  return (
    <div>
      {message && <div className={`message ${message.type}`}>{message.text}</div>}

      {references.length === 0 && (
        <div className="card">
          <p style={{ margin: 0 }}>登録されている参考記事はありません。</p>
        </div>
      )}

      {references.map((ref, i) => (
        <div className="item" key={`${ref.url}-${i}`}>
          <div className="item-header">
            <strong>{ref.label}</strong>
            <button className="danger" onClick={() => removeReference(i)} disabled={saving}>
              削除
            </button>
          </div>
          <p style={{ margin: "6px 0" }}>
            URL: <a href={ref.url} target="_blank" rel="noreferrer">{ref.url}</a>
            <br />
            メモ: {ref.note}
          </p>
        </div>
      ))}

      <div className="card">
        <h3>新しい参考記事を追加</h3>
        <label>表示名</label>
        <input type="text" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="例: 〇〇メディアの事例紹介記事" />

        <label>URL</label>
        <input type="text" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://..." />

        <label>メモ(何を参考にしたいか)</label>
        <textarea value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="例: 落ち着いたトーン、結論を先に述べる構成" />

        <button onClick={addDraft} disabled={saving}>
          {saving ? "保存中..." : "追加する"}
        </button>
      </div>
    </div>
  );
}
