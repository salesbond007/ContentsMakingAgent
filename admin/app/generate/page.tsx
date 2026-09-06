"use client";

import { useEffect, useState } from "react";
import type { CtaOption } from "@/lib/types";

interface HistoryEntry {
  keyword: string | null;
  ctaId: string | null;
  sourceUrls: string | null;
  requestedAt: string;
}

export default function GeneratePage() {
  const [keyword, setKeyword] = useState("");
  const [ctaId, setCtaId] = useState("");
  const [sourceUrls, setSourceUrls] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [ctas, setCtas] = useState<CtaOption[]>([]);

  function loadHistory() {
    return fetch("/api/generate")
      .then((r) => r.json())
      .then((data) => setHistory(data.requests ?? []));
  }

  useEffect(() => {
    loadHistory().finally(() => setHistoryLoading(false));
    fetch("/api/ctas")
      .then((r) => r.json())
      .then((data) => setCtas(data.ctas ?? []));
  }, []);

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
    loadHistory();
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="card">
        <label>keyword(記事にしたいキーワード。空欄可)</label>
        <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="例: 生成AIによる契約書レビュー自動化" />

        <label>CTA(空欄の場合はAIが記事内容から自動的に判断します)</label>
        <select value={ctaId} onChange={(e) => setCtaId(e.target.value)}>
          <option value="">(AIにおまかせ)</option>
          {ctas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}({c.id})
            </option>
          ))}
        </select>

        <label>参考URL(任意、カンマ区切り)</label>
        <textarea value={sourceUrls} onChange={(e) => setSourceUrls(e.target.value)} placeholder="https://example.com/a, https://example.com/b" />

        {message && <div className={`message ${message.type}`}>{message.text}</div>}

        <button type="submit" disabled={loading}>
          {loading ? "リクエスト中..." : "生成をリクエスト"}
        </button>
      </form>

      <div className="card">
        <h2>リクエスト履歴</h2>
        {historyLoading ? (
          <p>読み込み中...</p>
        ) : history.length === 0 ? (
          <p style={{ margin: 0 }}>まだ手動生成のリクエストはありません。</p>
        ) : (
          history.map((h, i) => (
            <div className="item" key={i}>
              <p style={{ margin: 0 }}>
                <strong>{h.keyword || "(キーワード未指定・CTAから逆算)"}</strong>
                <br />
                {h.ctaId && (
                  <>
                    CTA: <span className="badge">{h.ctaId}</span>
                    <br />
                  </>
                )}
                {h.sourceUrls && (
                  <>
                    参考URL: {h.sourceUrls}
                    <br />
                  </>
                )}
                <span style={{ color: "var(--muted)", fontSize: 12 }}>
                  {new Date(h.requestedAt).toLocaleString("ja-JP")}
                </span>
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
