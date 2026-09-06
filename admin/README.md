# BondAIメディア コンテンツ管理画面

コンテンツ制作パイプラインの設定(CTA・文体の参考記事)をブラウザから編集し、手動での記事生成をリクエストできる簡易管理画面。

内部的には、この画面自体はデータを持たない。GitHubリポジトリの `config/ctas.json` / `config/style-references.json` を直接読み書きし、記事生成は `../.github/workflows/daily-content.yml` の `workflow_dispatch` をGitHub Actions APIで発火するだけの薄いUI。

## デプロイ手順(Vercel・無料プラン)

### 1. GitHub Personal Access Token(PAT)を発行する

1. GitHubの自分のアカウント設定 →「Developer settings」→「Personal access tokens」→「Fine-grained tokens」
2. 「Generate new token」
3. Repository access: `salesbond007/ContentsMakingAgent` のみを選択
4. Permissions:
   - **Contents**: Read and write
   - **Actions**: Read and write
5. 発行されたトークン(`github_pat_...`)を控える(この画面専用の管理画面のみに使う。パイプライン本体のGitHub Actionsとは別物)

### 2. Vercelにプロジェクトを作成する

1. https://vercel.com/ にログイン(GitHubアカウントで連携可能、無料プランでOK)
2. 「Add New...」→「Project」→ このリポジトリ(`salesbond007/ContentsMakingAgent`)をインポート
3. 「Root Directory」を `admin` に設定(重要: これを忘れるとパイプライン本体をビルドしようとして失敗する)
4. Framework Presetは自動で「Next.js」になるはず

### 3. 環境変数を設定する

Vercelのプロジェクト設定 →「Environment Variables」で以下を追加(`.env.example` 参照):

| 変数名 | 値 |
|---|---|
| `ADMIN_PASSWORD` | 社内で共有するログインパスワード(なるべく複雑なもの) |
| `SESSION_SECRET` | ランダムな長い文字列(例: `openssl rand -hex 32` で生成) |
| `GITHUB_TOKEN` | 手順1で発行したPAT |
| `GITHUB_OWNER` | `salesbond007` |
| `GITHUB_REPO` | `ContentsMakingAgent` |

### 4. デプロイ

「Deploy」を押せば数分でURLが発行される。以降、`main` ブランチへのpushで自動再デプロイされる。

## セキュリティ上の注意

- 発行されたVercelのURLは、パスワードを知っている社内メンバーだけがアクセスする想定。URLの共有範囲に注意する
- `GITHUB_TOKEN` はサーバー側(API Route)でのみ使用し、ブラウザに送られることはない
- ログインセッションは12時間で自動的に切れる
