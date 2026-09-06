"use client";

import { useEffect, useState } from "react";

const DUMMY_DAILY_COUNTS = [
  { label: "08/24", value: 2 },
  { label: "08/25", value: 3 },
  { label: "08/26", value: 1 },
  { label: "08/27", value: 3 },
  { label: "08/28", value: 2 },
  { label: "08/29", value: 4 },
  { label: "08/30", value: 3 },
];

export default function DashboardPage() {
  const [dailyArticleCount, setDailyArticleCount] = useState<string | null>(null);
  const [showReviewGate, setShowReviewGate] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => setDailyArticleCount(data.dailyArticleCount ?? null))
      .catch(() => setDailyArticleCount(null));
  }, []);

  const dummyMax = Math.max(1, ...DUMMY_DAILY_COUNTS.map((d) => d.value));

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">自動実行</div>
          <div className="stat-value">毎日 07:00</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">1日あたりの生成本数</div>
          <div className="stat-value">
            {dailyArticleCount === null ? "-" : dailyArticleCount === "0" ? "自動生成なし" : `${dailyArticleCount}本`}
          </div>
        </div>
        <div className="stat-card clickable" onClick={() => setShowReviewGate(true)}>
          <div className="stat-label">査読ゲート</div>
          <div className="stat-value">80点 / 60点</div>
          <div className="stat-hint">評価軸を見る ›</div>
        </div>
      </div>

      <div className="card">
        <div className="item-header">
          <h2 style={{ margin: 0 }}>公開記事数の推移(直近7日・ダミーデータ)</h2>
          <a href="/analytics"><button className="secondary" style={{ marginTop: 0 }}>数値解析を開く</button></a>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
          {DUMMY_DAILY_COUNTS.map((d) => (
            <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <span style={{ width: 56, color: "var(--muted)", flexShrink: 0 }}>{d.label}</span>
              <div style={{ flex: 1, background: "var(--brand-light)", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${(d.value / dummyMax) * 100}%`,
                    background: "var(--brand)",
                    height: 16,
                  }}
                />
              </div>
              <span style={{ width: 24, textAlign: "right", flexShrink: 0 }}>{d.value}</span>
            </div>
          ))}
        </div>
        <p style={{ marginBottom: 0 }}>実データは「数値解析」ページで確認できます。</p>
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-icon">✎</div>
          <h2>コンテンツ生成</h2>
          <p>キーワードやCTAを指定して、自動生成とは別に記事を作成します。</p>
          <a href="/generate"><button>開く</button></a>
        </div>
      </div>

      <div className="card">
        <h2>関連リンク</h2>
        <p>
          <a href="https://github.com/salesbond007/ContentsMakingAgent/actions" target="_blank" rel="noreferrer">
            GitHub Actions(実行履歴・ログ)
          </a>
          {" ・ "}
          <a href="https://github.com/salesbond007/ContentsMakingAgent" target="_blank" rel="noreferrer">
            リポジトリ本体
          </a>
        </p>
      </div>

      {showReviewGate && (
        <div className="modal-overlay" onClick={() => setShowReviewGate(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
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
            <button className="modal-close secondary" onClick={() => setShowReviewGate(false)}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
