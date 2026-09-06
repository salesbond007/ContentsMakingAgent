export default function DashboardPage() {
  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">実行頻度</div>
          <div className="stat-value">毎日 06:00</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">生成方式</div>
          <div className="stat-value">全自動</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">査読ゲート</div>
          <div className="stat-value">80点 / 60点</div>
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
          <div className="card-icon">⚙</div>
          <h2>設定</h2>
          <p>1日あたりの生成本数・コスト上限を調整します。</p>
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
    </div>
  );
}
