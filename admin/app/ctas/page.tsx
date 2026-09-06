"use client";

import { useEffect, useState } from "react";

interface CtaOption {
  id: string;
  label: string;
  url: string;
  buttonText: string;
  useWhen: string;
}

const EMPTY: CtaOption = { id: "", label: "", url: "", buttonText: "", useWhen: "" };

export default function CtasPage() {
  const [ctas, setCtas] = useState<CtaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [draft, setDraft] = useState<CtaOption>(EMPTY);

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
    if (!draft.id || !draft.label || !draft.url || !draft.buttonText) {
      setMessage({ type: "error", text: "id・表示名・URL・ボタン文言は必須です" });
      return;
    }
    if (ctas.some((c) => c.id === draft.id)) {
      setMessage({ type: "error", text: "そのidは既に使われています" });
      return;
    }
    save([...ctas, draft]);
    setDraft(EMPTY);
  }

  function removeCta(id: string) {
    if (!confirm(`CTA「${id}」を削除しますか？`)) return;
    save(ctas.filter((c) => c.id !== id));
  }

  if (loading) return <p>読み込み中...</p>;

  return (
    <div>
      <h2>CTA管理</h2>
      <p>
        記事末尾に挿入するCTA(行動喚起リンク)の一覧です。AIはここに登録されたものの中からしか選べません
        (URLのでっち上げ防止のため)。内部リンクのように頻繁に変わるものは、都度ここで追加・削除してください。
      </p>

      {message && <div className={`message ${message.type}`}>{message.text}</div>}

      {ctas.map((cta) => (
        <div className="item" key={cta.id}>
          <div className="item-header">
            <strong>{cta.label}</strong>
            <button className="danger" onClick={() => removeCta(cta.id)} disabled={saving}>
              削除
            </button>
          </div>
          <p style={{ margin: "6px 0" }}>
            id: <code>{cta.id}</code>
            <br />
            URL: <a href={cta.url} target="_blank" rel="noreferrer">{cta.url}</a>
            <br />
            ボタン文言: {cta.buttonText}
            <br />
            使う場面: {cta.useWhen}
          </p>
        </div>
      ))}

      <div className="card">
        <h3>新しいCTAを追加</h3>
        <label>id(半角英数字、他と重複しないもの)</label>
        <input type="text" value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} placeholder="例: internal-link-2026-09" />

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
