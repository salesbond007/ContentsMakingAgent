"use client";

import { useEffect, useState } from "react";
import type { ReferenceMaterial, ReferenceMaterialType } from "@/lib/types";

const TYPE_LABEL: Record<ReferenceMaterialType, string> = {
  style: "文体参考",
  service: "サービス登録",
};

const TYPE_HELP: Record<ReferenceMaterialType, string> = {
  style: "見出しの立て方・構成・トーンだけを参考にする(内容は転載しない、業界が異なる記事でもよい)",
  service: "自社サービスに関する正確な情報源。LPや資料のURL、メモに書いた内容をそのまま執筆の根拠に使ってよい",
};

export default function ReferenceMaterialsPage() {
  const [materials, setMaterials] = useState<ReferenceMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [type, setType] = useState<ReferenceMaterialType>("style");
  const [label, setLabel] = useState("");
  const [urls, setUrls] = useState<string[]>([""]);
  const [memo, setMemo] = useState("");

  function load() {
    return fetch("/api/reference-materials")
      .then((r) => r.json())
      .then((data) => setMaterials(data.materials ?? []));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  function updateUrl(index: number, value: string) {
    setUrls((prev) => prev.map((u, i) => (i === index ? value : u)));
  }

  function addUrlField() {
    setUrls((prev) => [...prev, ""]);
  }

  function removeUrlField(index: number) {
    setUrls((prev) => prev.filter((_, i) => i !== index));
  }

  async function addMaterial() {
    const cleanedUrls = urls.map((u) => u.trim()).filter(Boolean);
    if (!label) {
      setMessage({ type: "error", text: "表示名は必須です" });
      return;
    }
    if (cleanedUrls.length === 0 && !memo) {
      setMessage({ type: "error", text: "URLまたはメモのどちらかは入力してください" });
      return;
    }

    setSaving(true);
    setMessage(null);

    const res = await fetch("/api/reference-materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, label, urls: cleanedUrls, memo }),
    });
    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMessage({ type: "error", text: body.error ?? "保存に失敗しました" });
      return;
    }

    setLabel("");
    setUrls([""]);
    setMemo("");
    setMessage({ type: "success", text: "保存しました。次回の記事生成から反映されます。" });
    await load();
  }

  async function removeMaterial(id: string, materialLabel: string) {
    if (!confirm(`「${materialLabel}」を削除しますか？`)) return;
    setSaving(true);
    setMessage(null);

    const res = await fetch(`/api/reference-materials?id=${encodeURIComponent(id)}`, { method: "DELETE" });
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
      <div className="card">
        <p style={{ marginBottom: 0 }}>
          「文体参考」は見出しの立て方・段落構成・語り口といった構造とトーンだけを参考にし、業界・商材が異なる
          記事を参考にする可能性もあるため書かれている内容は一切転載・流用しません。「サービス登録」は自社の
          サービス・商品に関する正確な情報源で、LP・資料のURLやメモに書いた内容をそのまま執筆の根拠として
          使います(架空の実績・料金等を創作させないため)。URLはLPが複数ある場合や資料を追加したい場合に
          備えて複数登録できます。
        </p>
      </div>

      {message && <div className={`message ${message.type}`}>{message.text}</div>}

      {materials.length === 0 && (
        <div className="card">
          <p style={{ margin: 0 }}>登録されている参考資料はありません。</p>
        </div>
      )}

      {materials.map((m) => (
        <div className="item" key={m.id}>
          <div className="item-header">
            <div>
              <strong>{m.label}</strong>
              <br />
              <span className="badge">{TYPE_LABEL[m.type] ?? m.type}</span>
            </div>
            <button className="danger" onClick={() => removeMaterial(m.id, m.label)} disabled={saving}>
              削除
            </button>
          </div>
          {m.urls.length > 0 && (
            <p style={{ margin: "6px 0" }}>
              URL:{" "}
              {m.urls.map((u, i) => (
                <span key={u}>
                  <a href={u} target="_blank" rel="noreferrer">{u}</a>
                  {i < m.urls.length - 1 ? " / " : ""}
                </span>
              ))}
            </p>
          )}
          {m.memo && <p style={{ margin: "6px 0" }}>メモ: {m.memo}</p>}
        </div>
      ))}

      <div className="card">
        <h3>新しい参考資料を追加</h3>
        <label>種別</label>
        <select value={type} onChange={(e) => setType(e.target.value as ReferenceMaterialType)}>
          {(Object.keys(TYPE_LABEL) as ReferenceMaterialType[]).map((key) => (
            <option key={key} value={key}>
              {TYPE_LABEL[key]}
            </option>
          ))}
        </select>
        <p style={{ marginTop: 4, marginBottom: 0, color: "var(--muted)", fontSize: 13 }}>{TYPE_HELP[type]}</p>

        <label>表示名</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={type === "style" ? "例: 〇〇メディアの事例紹介記事" : "例: 生成AI導入支援サービス"}
        />

        <label>URL(複数登録可。LPが複数ある場合や資料を貼りたい場合に追加してください)</label>
        {urls.map((u, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginTop: i === 0 ? 0 : 6 }}>
            <input type="text" value={u} onChange={(e) => updateUrl(i, e.target.value)} placeholder="https://..." />
            {urls.length > 1 && (
              <button type="button" className="secondary" style={{ marginTop: 0 }} onClick={() => removeUrlField(i)}>
                削除
              </button>
            )}
          </div>
        ))}
        <button type="button" className="secondary" onClick={addUrlField}>
          URLを追加
        </button>

        <label>メモ(URLを開かなくても分かる情報を直接書いてもよい)</label>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder={
            type === "style"
              ? "例: 落ち着いたトーン、結論を先に述べる構成"
              : "例: 月額5万円〜、導入実績30社、対応業界は製造業中心"
          }
        />

        <button onClick={addMaterial} disabled={saving}>
          {saving ? "保存中..." : "追加する"}
        </button>
      </div>
    </div>
  );
}
