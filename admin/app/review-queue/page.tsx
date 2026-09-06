"use client";

import { useEffect, useState } from "react";
import type { ReviewQueueItem } from "@/lib/types";

const VERDICT_LABEL: Record<string, string> = {
  "auto-publish": "AI査読: 自動公開相当",
  "needs-review": "AI査読: 要確認相当",
  rejected: "AI査読: 差し戻し相当",
};

export default function ReviewQueuePage() {
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function load() {
    return fetch("/api/review-queue")
      .then((r) => r.json())
      .then((data) => setItems(data.items ?? []));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function approve(item: ReviewQueueItem) {
    if (!confirm(`「${item.draft.title}」をCMSに反映(公開)しますか？`)) return;
    setBusyId(item.id);
    setMessage(null);

    const res = await fetch("/api/review-queue/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    });
    setBusyId(null);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMessage({ type: "error", text: body.error ?? "反映に失敗しました" });
      return;
    }

    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setMessage({
      type: "success",
      text: `「${item.draft.title}」の反映をリクエストしました。1分程度でCMSに公開されます(GitHub Actionsで進捗確認可能)。`,
    });
  }

  async function reject(item: ReviewQueueItem) {
    if (!confirm(`「${item.draft.title}」を却下しますか？(CMSには一切反映されず、破棄されます)`)) return;
    setBusyId(item.id);
    setMessage(null);

    const res = await fetch("/api/review-queue/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    });
    setBusyId(null);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMessage({ type: "error", text: body.error ?? "却下に失敗しました" });
      return;
    }

    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setMessage({ type: "success", text: `「${item.draft.title}」を却下しました。` });
  }

  if (loading) return <p>読み込み中...</p>;

  return (
    <div>
      <div className="card">
        <p style={{ marginBottom: 0 }}>
          「コンテンツ生成」から手動で作成した記事は、AIの査読結果に関わらずまずここに並びます。
          内容を確認し、「CMSに反映する」を押したものだけがmicroCMSへ公開されます。反映後は
          数分でGitHub Actions経由でCMSに登録されます(進捗はリポジトリのActionsタブで確認できます)。
        </p>
      </div>

      {message && <div className={`message ${message.type}`}>{message.text}</div>}

      {items.length === 0 && (
        <div className="card">
          <p style={{ margin: 0 }}>確認待ちの記事はありません。</p>
        </div>
      )}

      {items.map((item) => {
        const expanded = expandedId === item.id;
        return (
          <div className="item" key={item.id}>
            <div className="item-header">
              <div>
                <strong>{item.draft.title}</strong>
                <br />
                <span className="badge">{VERDICT_LABEL[item.review.verdict] ?? item.review.verdict}</span>{" "}
                <span style={{ color: "var(--muted)", fontSize: 12 }}>
                  スコア {item.review.total}点・{new Date(item.createdAt).toLocaleString("ja-JP")}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="secondary" style={{ marginTop: 0 }} onClick={() => setExpandedId(expanded ? null : item.id)}>
                  {expanded ? "閉じる" : "内容を確認"}
                </button>
                <button className="danger" style={{ marginTop: 0 }} onClick={() => reject(item)} disabled={busyId === item.id}>
                  却下する
                </button>
                <button style={{ marginTop: 0 }} onClick={() => approve(item)} disabled={busyId === item.id}>
                  {busyId === item.id ? "処理中..." : "CMSに反映する"}
                </button>
              </div>
            </div>

            {expanded && (
              <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                <p style={{ margin: "0 0 8px 0" }}>
                  <strong>キーワード:</strong> {item.draft.topic.keyword}
                  {item.draft.topic.targetProfile && (
                    <>
                      <br />
                      <strong>ターゲット:</strong> {item.draft.topic.targetProfile}
                    </>
                  )}
                  {item.draft.topic.notes && (
                    <>
                      <br />
                      <strong>指定内容:</strong> {item.draft.topic.notes}
                    </>
                  )}
                </p>

                {item.review.comments.length > 0 && (
                  <div className="message" style={{ background: "var(--brand-light)", color: "var(--brand)" }}>
                    <strong>AI査読コメント:</strong>
                    <ul style={{ margin: "4px 0 0 0", paddingLeft: 18 }}>
                      {item.review.comments.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <p style={{ margin: "8px 0" }}>
                  <strong>要約:</strong> {item.draft.excerpt}
                  <br />
                  <strong>カテゴリ:</strong> {item.draft.category}
                  {item.draft.tags.length > 0 && (
                    <>
                      <br />
                      <strong>タグ:</strong> {item.draft.tags.join(", ")}
                    </>
                  )}
                </p>

                {item.eyecatch && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.eyecatch.url} alt={item.eyecatch.alt} style={{ maxWidth: "100%", marginBottom: 12 }} />
                )}

                <div
                  style={{
                    border: "1px solid var(--border)",
                    padding: 16,
                    maxHeight: 480,
                    overflowY: "auto",
                    background: "#fbfafa",
                  }}
                  dangerouslySetInnerHTML={{ __html: item.draft.body }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
