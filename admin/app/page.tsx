export default function DashboardPage() {
  return (
    <div>
      <h2>ダッシュボード</h2>
      <p>BondAIメディアのコンテンツ制作パイプラインを管理します。GitHubリポジトリの設定ファイルを、この画面から直接編集できます。</p>

      <div className="dashboard-grid">
        <div className="card">
          <h2>記事を生成</h2>
          <p>キーワードやCTAを指定して、自動生成とは別に1本だけ記事を作成します。</p>
          <a href="/generate"><button>開く</button></a>
        </div>
        <div className="card">
          <h2>CTA管理</h2>
          <p>記事末尾に挿入するCTA・内部リンクの追加・編集・削除を行います。</p>
          <a href="/ctas"><button>開く</button></a>
        </div>
        <div className="card">
          <h2>文体の参考記事</h2>
          <p>ライティングエージェントが文体・構成の参考にする記事URLを管理します。</p>
          <a href="/style-references"><button>開く</button></a>
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
