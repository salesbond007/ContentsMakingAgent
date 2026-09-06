"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [dailyArticleCount, setDailyArticleCount] = useState("3");
  const [dailyApiCallCap, setDailyApiCallCap] = useState("4");
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingPause, setTogglingPause] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function loadSettings() {
    return fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setDailyArticleCount(data.dailyArticleCount ?? "3");
        setDailyApiCallCap(data.dailyApiCallCap ?? "4");
        setPaused(!!data.paused);
      });
  }

  useEffect(() => {
    loadSettings().finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dailyArticleCount, dailyApiCallCap }),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMessage({ type: "error", text: body.error ?? "保存に失敗しました" });
      return;
    }

    setMessage({ type: "success", text: "保存しました。次回の自動実行(毎日07:00 JST)から反映されます。" });
  }

  async function togglePause() {
    setTogglingPause(true);
    setMessage(null);

    const nextPaused = !paused;
    const res = await fetch("/api/settings/pause", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paused: nextPaused }),
    });

    setTogglingPause(false);

    if (!res.ok) {
      setMessage({ type: "error", text: "切り替えに失敗しました" });
      return;
    }

    setPaused(nextPaused);
    setMessage({
      type: "success",
      text: nextPaused
        ? "自動実行を停止しました。手動生成は引き続き使えます。"
        : "自動実行を再開しました。次回の毎日07:00 JSTから通常運転に戻ります。",
    });
  }

  if (loading) return <p>読み込み中...</p>;

  return (
    <div>
      <div className="card">
        <div className="item-header">
          <div>
            <h2 style={{ marginBottom: 4 }}>自動実行のステータス</h2>
            <p style={{ margin: 0 }}>
              現在:{" "}
              <span className="badge" style={paused ? { background: "#fdecea", color: "#b00020" } : undefined}>
                {paused ? "停止中" : "稼働中"}
              </span>
            </p>
          </div>
          <button className={paused ? undefined : "danger"} onClick={togglePause} disabled={togglingPause}>
            {togglingPause ? "処理中..." : paused ? "稼働を再開する" : "稼働を停止する"}
          </button>
        </div>
        <p style={{ marginBottom: 0 }}>
          停止中は毎日07:00 JSTの自動生成のみスキップされます。「記事を生成」からの手動実行は停止中でも実行できます。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card">
        <h2>自動実行の設定</h2>

        <label>1日あたりの生成本数</label>
        <input
          type="number"
          min={1}
          max={20}
          value={dailyArticleCount}
          onChange={(e) => setDailyArticleCount(e.target.value)}
        />

        <label>コスト上限(1日あたりのAPI呼び出し記事数の上限)</label>
        <input
          type="number"
          min={1}
          max={20}
          value={dailyApiCallCap}
          onChange={(e) => setDailyApiCallCap(e.target.value)}
        />
        <p style={{ marginBottom: 0 }}>
          生成本数がコスト上限を超える場合は、上限まで自動的に絞られます。
        </p>

        {message && <div className={`message ${message.type}`}>{message.text}</div>}

        <button type="submit" disabled={saving}>
          {saving ? "保存中..." : "保存する"}
        </button>
      </form>

      <div className="card">
        <h2>権限について</h2>
        <p style={{ marginBottom: 0 }}>
          この設定はGitHubリポジトリの「Variables」を直接更新します。もし保存時にエラーが出る場合は、
          管理画面用のGitHub Personal Access Tokenに「Variables: Read and write」権限が
          追加されているか確認してください(Contents・Actionsの権限だけでは更新できません)。
        </p>
      </div>
    </div>
  );
}
