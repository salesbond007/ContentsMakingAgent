# BondAIメディア コンテンツ管理画面

コンテンツ制作パイプラインの設定(CTA・文体の参考記事・自動実行のON/OFFや本数)をブラウザから編集し、手動での記事生成をリクエストできる管理画面。

内部的には、この画面自体はデータベースを持たない。GitHubリポジトリの `config/*.json` や `data/*.json` を直接読み書きし、記事生成は `../.github/workflows/daily-content.yml` の `workflow_dispatch` をGitHub Actions APIで発火するだけの薄いUI。

## デプロイ手順(Vercel・無料プラン)

### 1. GitHub Personal Access Token(PAT)を発行する

1. GitHubの自分のアカウント設定 →「Developer settings」→「Personal access tokens」→「Fine-grained tokens」
2. 「Generate new token」
3. Repository access: `salesbond007/ContentsMakingAgent` のみを選択
4. Permissions:
   - **Contents**: Read and write
   - **Actions**: Read and write
   - **Variables**: Read and write(「設定」画面から1日の生成本数・コスト上限・稼働停止/再開を変更する場合に必要。ContentsやActionsとは別の権限区分なので付け忘れに注意)
5. 発行されたトークン(`github_pat_...`)を控える(この画面専用の管理画面のみに使う。パイプライン本体のGitHub Actionsとは別物)

### 2. (メールログインを使う場合)Resendのアカウントを作る

1. https://resend.com/ でアカウント作成(無料枠: 月3,000通・1日100通まで無料)
2. ダッシュボードの「API Keys」から新しいAPIキーを発行して控える
3. 独自ドメイン(`salesbond.jp`)からの送信をしたい場合は「Domains」でドメイン認証(DNSレコード追加)が必要。面倒な場合は、まずは既定の送信元(`onboarding@resend.dev`)のままで動作確認してよい

メールログインを使わない場合はこの手順は不要(パスワードログインのみで運用できる)。

### 3. Vercelにプロジェクトを作成する

1. https://vercel.com/ にログイン(GitHubアカウントで連携可能、無料プランでOK)
2. 「Add New...」→「Project」→ このリポジトリ(`salesbond007/ContentsMakingAgent`)をインポート
3. 「Root Directory」を `admin` に設定(重要: これを忘れるとパイプライン本体をビルドしようとして失敗する)
4. Framework Presetは自動で「Next.js」になるはず

### 4. 環境変数を設定する

Vercelのプロジェクト設定 →「Environment Variables」で以下を追加(`.env.example` 参照):

| 変数名 | 値 |
|---|---|
| `ADMIN_PASSWORD` | 社内で共有するログインパスワード(なるべく複雑なもの) |
| `SESSION_SECRET` | ランダムな長い文字列(例: `openssl rand -hex 32` で生成) |
| `GITHUB_TOKEN` | 手順1で発行したPAT |
| `GITHUB_OWNER` | `salesbond007` |
| `GITHUB_REPO` | `ContentsMakingAgent` |
| `RESEND_API_KEY` | 手順2で発行したAPIキー(メールログインを使う場合のみ) |
| `MAIL_FROM` | 送信元表示。独自ドメイン未認証なら既定値のままでよい |
| `ALLOWED_EMAIL_DOMAIN` | `salesbond.jp`(このドメインのメールアドレスのみログインリンクを受け取れる) |
| `MICROCMS_SERVICE_DOMAIN` | パイプライン本体と同じmicroCMSのサービスドメイン(「数値解析」画面用) |
| `MICROCMS_API_KEY` | パイプライン本体と同じmicroCMSの公開APIキー(下書きは読めないため公開数の集計に丁度良い) |
| `MICROCMS_ARTICLES_ENDPOINT` | `articles`(パイプライン本体と合わせる) |

`RESEND_API_KEY` を設定しない場合、メールログインのリクエストはエラーになるが、**パスワードログインは影響を受けず引き続き使える**。
`MICROCMS_*` を設定しない場合、「数値解析」画面のみエラー表示になるが、他の画面は影響を受けない。

### 5. デプロイ

「Deploy」を押せば数分でURLが発行される。以降、`main` ブランチへのpushで自動再デプロイされる。

## ログイン方法

- **メールログイン**: `@salesbond.jp` のメールアドレスを入力すると、ログインリンク(15分間有効)がメールで届く。リンクをクリックするとログインされる
- **パスワードログイン**: 従来通り、共有パスワードでもログインできる(メールが届かない場合のバックアップ用)

## セキュリティ上の注意

- 発行されたVercelのURLは、社内メンバーだけがアクセスする想定。URLの共有範囲に注意する
- `GITHUB_TOKEN` / `RESEND_API_KEY` / `MICROCMS_API_KEY` はサーバー側(API Route)でのみ使用し、ブラウザに送られることはない
- ログインセッションは12時間で自動的に切れる
- ログインリンクのトークンは15分で失効し、一度使用したリンクは(同一インスタンス内では)再利用できない
- パスワードログイン・メールログインリクエストの両方に簡易的なレート制限を掛けている(総当たり・大量メール送信の抑止)
- 状態を変更するAPI(設定変更・生成リクエスト等)はOriginヘッダを検証し、他サイトからの不正なリクエストを拒否する
- `X-Frame-Options` 等のセキュリティヘッダを全ページに付与している
