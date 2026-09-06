# ContentsMakingAgent

BondAIメディア向けのコンテンツ制作自動化パイプライン。情報収集→執筆→画像生成→査読・ファクトチェック→microCMS公開までを、GitHub Actionsのcronで1日1回・記事3本分自動実行する。

要件の全文は [`docs/requirements.md`](./docs/requirements.md) を参照。

## 記事の正確性を高める仕組み

ライティングエージェント・査読エージェントは、Claude公式のサーバー側ツール `web_fetch`(指定URLの実取得)と
`web_search`(補足検索)を有効化している(`src/clients/claude.ts` の `WEB_TOOLS`)。
これにより、参考ソースURLの文字列だけを見て書く/査読するのではなく、実際にページ内容を取得したうえで
執筆・ファクトチェックを行う。1記事あたりの検索・取得回数には上限(`max_uses`)を設けてコストを抑えている。

## SEO品質

- **検索意図分析**(`src/agents/searchIntent.ts`): 執筆前にweb_searchで実際に検索し、上位記事の見出し・切り口を踏まえて「誰が・何に困って検索しているか」「上位記事に共通する必須要素」「差別化の余地」を分析し、ライティングエージェントに渡す。失敗しても分析結果なしで執筆に進む(必須ではない)。
- **見出し階層**: 大見出しはすべてh2、細かい論点だけh3にするようライティングエージェントに指示している(h2を飛ばしていきなりh3にする等を禁止)。
- **キーワード出現**: 記事のキーワードを冒頭1〜2段落と本文中に自然な形で複数回登場させる(不自然な詰め込みは禁止)。
- **結論ファースト・文字数**: 各見出し(h2/h3)は結論を最初の一文で述べてから詳細を続け、1つのh2セクションあたり300〜500字程度を目安にする。
- **一次情報**: web_fetch/web_searchで実際に確認できた事例・数値があれば最低1つ盛り込む。ただし確認できた情報が無い場合、自社の実績・数値を創作することは禁止(ハルシネーション防止)。
- **meta情報**: `seoMetaTitle`は30文字前後、`seoMetaDescription`は120文字前後でキーワードを含み、クリックしたくなる具体的な内容にするよう指示している。
- **内部リンク・構造化データ(schema.org)**: 未対応。内部リンクは記事URLの命名規則が定まり次第(現状は`config/ctas.json`の`internal-link-*`エントリで手動運用)、構造化データはサイト側でJSON-LDを出力する実装が必要(いずれもサイト側リポジトリとの連携が前提)。
- **検索ボリューム・難易度**: 対応していない。Ahrefs等の有料SEOツールのAPI契約が前提になるため、契約する場合は追加実装が必要。

## CTA（記事末尾の行動喚起リンク）

[`config/ctas.json`](./config/ctas.json) に実在するCTA（セミナー申込、サービス紹介など）を事前登録しておくと、
ライティングエージェントが記事内容に最も合うものを1つ選ぶ。
URLのハルシネーション（存在しないリンクのでっち上げ）を防ぐため、AIには一覧の中からIDを選ばせるだけで、
URLそのものは生成させない。使わなくなったCTAはJSONから削除するだけでよい（コード変更不要）。
`CTA_CONFIG_PATH` で別ファイルを指定することも可能（通常は不要）。

選ばれたCTAは、検索意図の「温度感」に合わせて本文中の**3箇所**に同じリンクを配置する
（`src/agents/writing.ts` の `insertCtas`）: 導入直後の`cta-banner`、本文中で読者の課題に触れた直後の
`cta-inline`、記事末の`cta-footer`。サイト側でこの3つのclassにそれぞれ異なる見た目（バナー/インラインリンク/ボタン等）を
あてることを想定している。CTAが選ばれなかった場合はプレースホルダーごと除去される。

## 本文中の表・図解

- **表**: 比較・一覧など表形式が適切な内容は、ライティングエージェントが本文にそのまま `<table>` を出力する。
- **グラフ**: 出典から実際に確認した数値データがある場合のみ、`src/lib/chartSvg.ts` でコード側が正確なSVG棒グラフを描画する（AI画像生成には正確な数値を描かせられないため、架空の数値のグラフが生成されるリスクを避けている）。
- **概念図**: 数値を伴わないプロセス図・関係図は、gpt-image-1で生成する（誤情報混入を防ぐため画像内に文字・数字は入れない指示にしている）。

ライティングエージェントは本文中に `[[FIGURE:token]]` というプレースホルダーを最大3つまで挿入でき、
画像生成・公開の段階で実際の `<img>` タグに置き換わる（生成に失敗した図解のプレースホルダーは自動的に除去される）。
画像生成コストとのバランスから、見出しごとに1枚ではなく記事全体で最大3枚に抑えている。

## 文体の参考記事

[`config/style-references.json`](./config/style-references.json) にお手本にしたい記事のURLを登録しておくと、
ライティングエージェントがweb_fetchで実際に取得し、文体・構成のトーンを参考にする（内容の転載はしない）。
デザイン（配色・レイアウトなど視覚面）の参考はサイト側リポジトリの担当範囲になるため、ここには含めない。
CTA一覧と同様、追加・削除はこのJSONファイルを直接編集するだけでよい（コード変更不要）。
`STYLE_REFERENCES_PATH` で別ファイルを指定することも可能（通常は不要）。

## 手動実行（管理画面代わり）

新しいアプリを作らず、GitHub Actionsの「Run workflow」画面自体を簡易的な管理画面として使える。
「Actions」タブ →「Daily Content Pipeline」→「Run workflow」を開くと、以下の入力欄が出る。

- **keyword**: 記事にしたいキーワードを直接指定する。指定すると情報収集エージェントをスキップし、そのキーワードだけで1本生成する
- **cta_id**: 使いたいCTAの`id`（[`config/ctas.json`](./config/ctas.json)参照）を指定すると、そのCTAを必ず使う。keywordを空にしてcta_idだけ指定すると、そのCTAへ自然につながる記事テーマをAIが逆算して1本提案・生成する（「CTAから逆算」運用）
- **source_urls**: 参考にしてほしいURL（カンマ区切り、任意）

3つとも空欄のまま実行すれば、通常の自動収集(1日3本分の設定はそのまま)で実行される。
毎日06:00 JSTの自動cronはこれらの入力を使わず、常に自動収集モードで動く。

将来的に、生成本数の推移や査読スコアの分布、CTAのクリック率・記事の閲覧率などを見たい場合は、
GitHub Actionsの実行ログだけでは追えないため、サイト側にGA4等の計測を入れたうえで別途ダッシュボードを
検討する（サイト側の対応が前提になるため、現時点ではスコープ外）。

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
