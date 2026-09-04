# ContentsMakingAgent

BondAIメディア向けのコンテンツ制作自動化パイプライン。情報収集→執筆→画像生成→査読・ファクトチェック→microCMS公開までを、GitHub Actionsのcronで1日1回・記事3本分自動実行する。

要件の全文は [`docs/requirements.md`](./docs/requirements.md) を参照。

## 構成

```
src/
  agents/      各工程のロジック（研究・執筆・画像生成・査読・公開）
  clients/     外部API連携（Claude, OpenAI, microCMS, Slack, Googleドライブ, RSS）
  pipeline.ts  6工程をオーケストレーションするメインループ
  index.ts     エントリーポイント（GitHub Actionsから実行）
```

## セットアップ

```bash
npm install
cp .env.example .env   # 各種APIキーを設定
npm run dev             # ローカル実行
npm test                # 査読ゲートのしきい値ロジックなどをテスト
npm run build && npm start
```

## 必須の環境変数

`.env.example` を参照。最低限、以下が無いと起動時にエラーになる:

- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`
- `MICROCMS_SERVICE_DOMAIN` / `MICROCMS_API_KEY`

Slack通知・Googleドライブ連携・競合RSS巡回は任意（未設定でもパイプラインは動作し、該当機能のみスキップされる）。

## microCMSに必要なコンテンツ型

- `articles`: title(テキスト), excerpt(テキストエリア), body(リッチエディタ等), category(テキスト等), tags(テキストエリア、改行区切り), seoMetaTitle(テキスト), seoMetaDescription(テキストエリア), eyecatch(画像), eyecatchAlt(テキスト), publishTargets(テキストエリア、改行区切り), reviewScore(数字), reviewComments(テキストエリア)
- `keywords`: keyword(テキスト), sourceUrls(テキストエリア、改行区切り), usedAt(日時), articleId(テキスト)（重複キーワード防止の台帳）

`seo` はmicroCMSの「カスタムフィールド」を使わずに済むよう、ネストしたオブジェクトにせず `seoMetaTitle` / `seoMetaDescription` の2つのフラットなフィールドとして扱う。
`tags` / `sourceUrls` / `publishTargets` のような配列項目も、microCMSの「複数選択」（選択肢の事前登録が必要）を避け、
改行区切りの1本のテキストとして保存・読み出しする（`src/clients/microcms.ts` の `toMultilineText`/`fromMultilineText`）。

型（フィールドが存在すること）自体はmicroCMS側で確定させる必要があるが、**各フィールドのフィールドID（項目名）はコードを変更せずに追従できる**。
[`config/microcms-fields.json`](./config/microcms-fields.json) が論理名→実際のフィールドIDの対応表になっており、
microCMS側でフィールドIDをリネームした場合はこのJSONファイルを書き換えるだけでよい（TypeScriptの変更・再ビルドは不要、push後の次回実行から反映される）。
一部のフィールドだけ書き換えれば十分で、書かれていないフィールドはデフォルト値が使われる。
ファイル自体が存在しない場合もデフォルト値にフォールバックする。

## 査読ゲートのしきい値

要件定義書の提案値をデフォルトとし、環境変数で調整可能:

- `REVIEW_AUTO_PUBLISH_THRESHOLD`（既定80） 以上 → 自動公開
- `REVIEW_NEEDS_CHECK_THRESHOLD`（既定60） 以上 → 下書き保存・要確認キュー・Slack通知
- それ未満 → 差し戻し（記事はスキップ）

## コスト上限

`DAILY_ARTICLE_COUNT`（既定3）が `DAILY_API_CALL_CAP`（既定4）を超える場合は上限まで実行数を絞り、Slackに通知する。

## GitHub Actions

`.github/workflows/daily-content.yml` がcronで毎日起動する（既定: 06:00 JST）。以下をリポジトリのSecrets/Variablesに登録すること:

- Secrets: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `MICROCMS_SERVICE_DOMAIN`, `MICROCMS_API_KEY`, `SLACK_WEBHOOK_URL`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_DRIVE_FOLDER_ID`
- Variables: `MICROCMS_ARTICLES_ENDPOINT`, `MICROCMS_KEYWORDS_ENDPOINT`, `COMPETITOR_RSS_FEEDS`, `DAILY_ARTICLE_COUNT`, `DAILY_API_CALL_CAP`, `REVIEW_AUTO_PUBLISH_THRESHOLD`, `REVIEW_NEEDS_CHECK_THRESHOLD`, `PUBLISH_TARGET_NAME`

## CI

`.github/workflows/ci.yml` がpush/PR時にtypecheck・test・buildを自動実行する。

## 未実装・要確認事項（要件定義書「09 — 未決定・次のステップ」より）

- 査読しきい値・掲載先自動判定・コスト上限の最終承認（社長判断待ち）
- 競合・業界サイトの巡回対象URLリスト（現状は `COMPETITOR_RSS_FEEDS` にRSS URLを設定する運用）
- ブランド・トンマナガイドラインの整備（現状は査読プロンプト内に簡易的な方針のみ記述）
- Googleサービスアカウントの発行・共有ドライブフォルダの準備
- PowerPoint(.pptx)ファイルのテキスト抽出は未実装（Googleドキュメント・Word(.docx)は対応済み）
- microCMSの下書き保存API仕様（`status=draft` クエリ）は契約プランにより異なる場合があるため、導入時に実挙動を確認すること
- 実APIキー未設定のためエンドツーエンドの実行検証はまだ行えていない。キー登録後に `workflow_dispatch` での試験実行を推奨
