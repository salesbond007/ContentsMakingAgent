"use client";

import { useState } from "react";

export default function GeneratePage() {
  const [keyword, setKeyword] = useState("");
  const [ctaId, setCtaId] = useState("");
  const [sourceUrls, setSourceUrls] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, cta_id: ctaId, source_urls: sourceUrls }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMessage({ type: "error", text: body.error ?? "実行に失敗しました" });
      return;
    }

    setMessage({
      type: "success",
      text: "記事生成をリクエストしました。数分後にSlackへ完了通知が届きます。進捗はGitHub Actionsでも確認できます。",
    });
    setKeyword("");
    setCtaId("");
    setSourceUrls("");
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="card">
        <label>keyword(記事にしたいキーワード。空欄可)</label>
        <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="例: 生成AIによる契約書レビュー自動化" />

        <label>cta_id(使いたいCTAのid。「CTA管理」画面で確認できます。空欄可)</label>
        <input type="text" value={ctaId} onChange={(e) => setCtaId(e.target.value)} placeholder="例: seminar" />

        <label>参考URL(任意、カンマ区切り)</label>
        <textarea value={sourceUrls} onChange={(e) => setSourceUrls(e.target.value)} placeholder="https://example.com/a, https://example.com/b" />

        {message && <div className={`message ${message.type}`}>{message.text}</div>}

        <button type="submit" disabled={loading}>
          {loading ? "リクエスト中..." : "生成をリクエスト"}
        </button>
      </form>
    </div>
  );
}
