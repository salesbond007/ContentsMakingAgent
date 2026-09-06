"use client";

import { useEffect, useState } from "react";
import type { CtaOption, TargetProfile } from "@/lib/types";

interface HistoryEntry {
  keyword: string | null;
  ctaId: string | null;
  sourceUrls: string | null;
  notes: string | null;
  target: string | null;
  requestedAt: string;
}

export default function GeneratePage() {
  const [keyword, setKeyword] = useState("");
  const [ctaIds, setCtaIds] = useState<string[]>([]);
  const [targetId, setTargetId] = useState("");
  const [targetFreeText, setTargetFreeText] = useState("");
  const [sourceUrls, setSourceUrls] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [ctas, setCtas] = useState<CtaOption[]>([]);
  const [targets, setTargets] = useState<TargetProfile[]>([]);

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
    fetch("/api/targets")
      .then((r) => r.json())
      .then((data) => setTargets(data.targets ?? []));
  }, []);

  function toggleCta(id: string) {
    setCtaIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const selectedTarget = targets.find((t) => t.id === targetId);
    const target = targetFreeText.trim() || selectedTarget?.description || "";

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, cta_id: ctaIds.join(","), source_urls: sourceUrls, notes, target }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMessage({ type: "error", text: body.error ?? "実行に失敗しました" });
      return;
    }

    setMessage({
      type: "success",
      text: "記事生成をリクエストしました。生成が完了すると「確認待ち」ページに追加されます(CMSへはまだ反映されません)。Slackにも完了通知が届きます。",
    });
    setKeyword("");
    setCtaIds([]);
    setTargetId("");
    setTargetFreeText("");
    setSourceUrls("");
    setNotes("");
    loadHistory();
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="card">
        <h2>手動で記事を生成</h2>

        <label>キーワード(複数指定可、カンマ区切り。空欄可)</label>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="例: 生成AIによる契約書レビュー自動化, 生成AIの導入コスト"
        />
        <p style={{ marginTop: 4, marginBottom: 0 }}>
          複数指定すると、キーワードごとに1本ずつまとめて生成します。
        </p>

        <label>CTA(複数選択可。何も選ばない場合はAIが記事内容から自動的に判断します)</label>
        {ctas.length === 0 ? (
          <p style={{ marginTop: 4 }}>登録されているCTAはありません。</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            {ctas.map((c) => (
              <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, textTransform: "none", fontWeight: 400, margin: 0 }}>
                <input
                  type="checkbox"
                  style={{ width: "auto" }}
                  checked={ctaIds.includes(c.id)}
                  onChange={() => toggleCta(c.id)}
                />
                {c.label}
              </label>
            ))}
          </div>
        )}

        <label>ターゲット(登録済みプロフィールから選択、または自由記述。両方空欄可)</label>
        <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
          <option value="">(指定なし)</option>
          {targets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <textarea
          value={targetFreeText}
          onChange={(e) => setTargetFreeText(e.target.value)}
          placeholder="自由記述でターゲットを指定する場合はこちら(入力するとプロフィール選択より優先されます)"
        />

        <label>その他盛り込んで欲しい内容(自由記述、任意)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="例: 比較表を入れて分かりやすく。導入事例に触れてほしい 等"
        />

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
                {h.target && (
                  <>
                    ターゲット: {h.target}
                    <br />
                  </>
                )}
                {h.notes && (
                  <>
                    盛り込んで欲しい内容: {h.notes}
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
