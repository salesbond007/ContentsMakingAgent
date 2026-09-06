"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [dailyArticleCount, setDailyArticleCount] = useState("3");
  const [dailyApiCallCap, setDailyApiCallCap] = useState("4");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function loadSettings() {
    return fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setDailyArticleCount(data.dailyArticleCount ?? "3");
        setDailyApiCallCap(data.dailyApiCallCap ?? "4");
        if (data.error) {
          setMessage({ type: "error", text: `現在の設定値を取得できませんでした(表示は既定値): ${data.error}` });
        }
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

  if (loading) return <p>読み込み中...</p>;

  return (
    <div>
      <form onSubmit={handleSubmit} className="card">
        <h2>自動実行の設定</h2>

        <label>1日あたりの生成本数(0を指定すると自動生成を行いません)</label>
        <input
          type="number"
          min={0}
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
          生成本数がコスト上限を超える場合は、上限まで自動的に絞られます。0を指定すると、毎日07:00 JSTの
          自動生成自体を行わなくなります(「記事を生成」からの手動生成は引き続き使えます)。
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
