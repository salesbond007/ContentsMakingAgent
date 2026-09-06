"use client";

import { useEffect, useState } from "react";

export default function ThumbnailPage() {
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/thumbnail-style")
      .then((r) => r.json())
      .then((data) => {
        setReferenceImageUrl(data.referenceImageUrl ?? "");
        setNote(data.note ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const res = await fetch("/api/thumbnail-style", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referenceImageUrl, note }),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMessage({ type: "error", text: body.error ?? "保存に失敗しました" });
      return;
    }

    setMessage({ type: "success", text: "保存しました。次回のアイキャッチ画像生成から反映されます。" });
  }

  if (loading) return <p>読み込み中...</p>;

  return (
    <div>
      <div className="card">
        <h2>サムネイル(アイキャッチ画像)のデザイン参考</h2>
        <p>
          参考にしたい画像のURLを登録しておくと、記事のアイキャッチ画像を生成する際に
          その画像の配色・構図・雰囲気を踏襲して新しく描き直します(画像そのものをコピーするわけではありません)。
          空欄のまま保存すると、参考画像なしの通常生成に戻ります。
        </p>

        <form onSubmit={handleSubmit}>
          <label>参考画像URL</label>
          <input
            type="text"
            value={referenceImageUrl}
            onChange={(e) => setReferenceImageUrl(e.target.value)}
            placeholder="https://example.com/sample-thumbnail.png"
          />

          <label>補足メモ(任意。デザインのどの部分を参考にしてほしいか)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例: 左側にアイコン、右側にタイトル風のスペースを空けたレイアウト"
          />

          {message && <div className={`message ${message.type}`}>{message.text}</div>}

          <button type="submit" disabled={saving}>
            {saving ? "保存中..." : "保存する"}
          </button>
        </form>
      </div>

      {referenceImageUrl && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>プレビュー</h3>
          {/* 管理者が登録した外部URLの画像をそのまま表示するだけの用途のため、next/imageの最適化は不要 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={referenceImageUrl} alt="参考画像プレビュー" style={{ maxWidth: "100%" }} />
        </div>
      )}
    </div>
  );
}
