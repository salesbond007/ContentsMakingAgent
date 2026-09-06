"use client";

import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [dailyArticleCount, setDailyArticleCount] = useState<string | null>(null);
  const [showReviewGate, setShowReviewGate] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => setDailyArticleCount(data.dailyArticleCount ?? null))
      .catch(() => setDailyArticleCount(null));
  }, []);

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

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-icon">✎</div>
          <h2>記事を生成</h2>
          <p>キーワードやCTAを指定して、自動生成とは別に1本だけ記事を作成します。</p>
          <a href="/generate"><button>開く</button></a>
        </div>
        <div className="card">
          <div className="card-icon">📊</div>
          <h2>数値解析</h2>
          <p>公開記事数の推移(日次・月次)を確認します。</p>
          <a href="/analytics"><button className="secondary">開く</button></a>
        </div>
        <div className="card">
          <div className="card-icon">🔗</div>
          <h2>CTA管理</h2>
          <p>記事末尾に挿入するCTA・内部リンクの追加・編集・削除を行います。</p>
          <a href="/ctas"><button className="secondary">開く</button></a>
        </div>
        <div className="card">
          <div className="card-icon">📄</div>
          <h2>文体の参考記事</h2>
          <p>ライティングエージェントが文体・構成の参考にする記事URLを管理します。</p>
          <a href="/style-references"><button className="secondary">開く</button></a>
        </div>
        <div className="card">
          <div className="card-icon">🖼</div>
          <h2>サムネイル</h2>
          <p>アイキャッチ画像生成のデザイン参考画像を設定します。</p>
          <a href="/thumbnail"><button className="secondary">開く</button></a>
        </div>
        <div className="card">
          <div className="card-icon">⚙</div>
          <h2>設定</h2>
          <p>1日あたりの生成本数(0で自動生成なし)・コスト上限を調整します。</p>
          <a href="/settings"><button className="secondary">開く</button></a>
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
