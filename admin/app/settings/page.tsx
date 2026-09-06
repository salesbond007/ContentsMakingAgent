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
      const body = await res.json().catch(() => ({}));
      setMessage({ type: "error", text: body.error ?? "切り替えに失敗しました" });
      return;
    }

    setPaused(nextPaused);
    setMessage({
      type: "success",
      text: nextPaused
        ? "生成方式を「手動」に切り替えました(自動実行は停止)。「記事を生成」からの手動生成は引き続き使えます。"
        : "生成方式を「全自動」に切り替えました。次回の毎日07:00 JSTから通常運転に戻ります。",
    });
  }

  if (loading) return <p>読み込み中...</p>;

  return (
    <div>
      <div className="card">
        <div className="item-header">
          <div>
            <h2 style={{ marginBottom: 4 }}>生成方式</h2>
            <p style={{ margin: 0 }}>
              現在:{" "}
              <span className="badge" style={paused ? { background: "#fdecea", color: "#b00020" } : undefined}>
                {paused ? "手動" : "全自動"}
              </span>
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className={paused ? undefined : "secondary"}
              onClick={() => paused && togglePause()}
              disabled={togglingPause || !paused}
            >
              全自動
            </button>
            <button
              className={paused ? "secondary" : "danger"}
              onClick={() => !paused && togglePause()}
              disabled={togglingPause || paused}
            >
              手動(強制停止)
            </button>
          </div>
        </div>
        <p style={{ marginBottom: 0 }}>
          「全自動」中は毎日07:00 JSTに自動で記事生成・公開まで実行されます。「手動(強制停止)」に切り替えると
          自動実行だけが止まります(＝稼働停止と同じ意味)。「記事を生成」からの手動実行はどちらのモードでも使えます。
        </p>
        {message && <div className={`message ${message.type}`} style={{ marginTop: 12 }}>{message.text}</div>}
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

      <div className="card">
        <h2>査読ゲートの評価軸</h2>
        <p>
          生成された記事は公開前に、AIによる査読(ファクトチェック)を必ず通過します。以下の4観点を
          各0〜25点で採点し、合計点をしきい値と比較して「自動公開」「下書き保存(要確認)」「差し戻し」の
          いずれかに振り分けます(<code>src/agents/review.ts</code>)。
        </p>
        <ul style={{ marginTop: 0 }}>
          <li><strong>事実確認(0〜25点)</strong>: 参考ソースURLの内容を実際に取得し、本文の主張・数値が整合しているか</li>
          <li><strong>リスク表現(0〜25点)</strong>: 「必ず」「保証します」等の断定表現、誇大表現、薬機法・景表法的にグレーな言い回しが無いか(NGワードの機械チェックも加味)</li>
          <li><strong>ブランド・トンマナ(0〜25点)</strong>: BtoBメディアとして落ち着いた文体・語彙になっているか</li>
          <li><strong>剽窃・重複(0〜25点)</strong>: 出典の丸写しや、既存の自社記事とテーマ・切り口が実質的に重複していないか</li>
        </ul>
        <p style={{ marginBottom: 0 }}>
          合計点80点以上(既定)で自動公開、60点以上(既定)で下書き保存・要確認、それ未満は差し戻しになります。
          しきい値はGitHubリポジトリのVariables(<code>REVIEW_AUTO_PUBLISH_THRESHOLD</code> /{" "}
          <code>REVIEW_NEEDS_CHECK_THRESHOLD</code>)で調整できます(この管理画面からはまだ変更できません)。
        </p>
      </div>
    </div>
  );
}
