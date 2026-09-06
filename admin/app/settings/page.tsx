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
