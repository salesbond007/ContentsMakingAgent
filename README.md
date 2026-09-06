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
- **内部リンク**: [`config/site.json`](./config/site.json) の `articleUrlPattern`(例: `https://media.example.com/articles/{id}`)を設定すると、直近の公開記事一覧をライティングエージェントに渡し、本文と関連が深い場合のみ自然な文脈でリンクを挿入する(でっち上げ防止のため、ここで取得したURL以外は使わせない)。空欄のままなら機能自体が無効化される。それとは別に、頻繁に差し替えたい訴求リンクは引き続き`config/ctas.json`の`internal-link-*`エントリで手動運用できる。構造化データ(schema.org)は未対応(サイト側でJSON-LDを出力する実装が必要)。
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

## 全体設定(絶対厳守ルール)

[`config/global-settings.json`](./config/global-settings.json) の `mustNotViolate` に自由記述で登録した内容は、
自動実行・手動生成を問わずすべての記事生成が絶対に違反してはならない最優先ルールとしてライティング・査読
両エージェントに渡される。例えば「製造業のAI初心者向けに書く」と設定すれば、その前提から絶対にずれた記事
(専門家向け・別業界向け等)は生成されず、査読エージェントもこの設定への違反を採点に反映する。空欄なら制約なし。
管理画面の「コンテンツ設計」→「全体設定」からも編集できる。`GLOBAL_SETTINGS_PATH`で別ファイルを指定可能（通常は不要）。

## 参考記事(文体参考・サービス登録)

[`config/reference-materials.json`](./config/reference-materials.json) に登録した参考資料は、種別によって
扱いが異なる。
- **文体参考(style)**: お手本にしたい記事。ライティングエージェントがweb_fetchで実際に取得し、
  見出しの立て方・構成・語り口といった「構造とトーン」だけを参考にする（内容の転載・流用はしない。
  業界・商材が異なる記事を参考にすることも想定している）。
- **サービス登録(service)**: 自社サービス・商品に関する正確な情報源(LP・資料のURL、または直接書いた
  メモ)。CTAや本文で自社サービスに触れる際、ここに登録された情報だけを正しい情報源として使い、
  存在しない実績・料金等を創作しない（ハルシネーション防止）。

いずれもURLは1件につき複数登録できる(LPが複数ある場合や資料を追加したい場合を想定)。デザイン（配色・
レイアウトなど視覚面）の参考はサイト側リポジトリの担当範囲になるため、ここには含めない。追加・削除は
このJSONファイルを直接編集するか、管理画面の「参考記事」ページから行う（コード変更不要）。
`REFERENCE_MATERIALS_PATH` で別ファイルを指定することも可能（通常は不要）。

## NGワード・トンマナチェック

[`config/ng-words.json`](./config/ng-words.json) に登録した語句は、査読エージェントに渡す前に機械的に
本文をスキャンし、含まれていればリスク表現の点数を下げるよう指示する(AIの判断だけに頼らない機械チェックとの併用)。
薬機法・景表法的にグレーな断定表現や、自社として避けたい言い回しを人間が随時追加・削除できる(コード変更不要)。

## 画像素材(アイキャッチ・図解のデザイン参考)

[`config/images.json`](./config/images.json) に画像素材を登録できる。用途(`useCase`)は
`chart`(グラフ) / `seminar`(セミナー誘致) / `thumbnail`(通常記事のサムネ)の3種類。
`thumbnail`用途の画像が登録されている場合、アイキャッチ画像生成時にgpt-image-1の画像編集API
(`images.edit`)でその配色・構図・雰囲気を踏襲して新しく描き直す。参考画像の実体はGoogleドライブに
格納する運用とし（管理画面の「画像」ページに格納先フォルダのリンクを掲載）、`url`にはその共有リンク、
または別途アップロードした画像の直接URLを登録する。参考画像の取得・編集APIが失敗した場合は自動的に
通常生成にフォールバックする。管理画面の「画像」ページからも編集できる。

## タイトルA/B案・画像alt/ファイル名のSEO対応

ライティングエージェントはメインのタイトルとは別に、雰囲気の異なる代替タイトル案を2つ提示する
(`draft.altTitles`)。人間が下書き確認時に選べるよう、microCMSの`reviewComments`フィールドに追記して保存する。
画像ファイル名は`Date.now()`のような無意味な名前を避け、記事タイトルから生成したスラッグを含む名前にする
(`src/lib/seoFile.ts`)。alt文言も125文字を超える場合は自動的に切り詰める。

## リライト候補検知・週次サマリー

`src/agents/rewriteCandidates.ts` が、公開から`REWRITE_THRESHOLD_DAYS`(既定90)日以上経過した記事を
リストアップする。あくまで「提案」に留め、自動でのリライト・再公開は行わない。
`.github/workflows/weekly-report.yml`が週1回(月曜21:10 JST)起動し、直近7日間の
公開・下書き・差し戻し・エラー件数の合計(`data/daily-stats.json`に日次蓄積)とリライト候補をSlackに送信する。

## 手動実行（管理画面 / GitHub Actions）

非エンジニアでも使えるよう、[`admin/`](./admin/README.md) に専用の管理画面(Next.js、Vercelにデプロイ)がある。
「コンテンツ生成」ページからキーワード(カンマ区切りで複数指定可)・CTA(複数選択可)・ターゲット(登録済み
プロフィールの選択、または自由記述)・その他盛り込んで欲しい内容(自由記述)・参考URLを指定して手動生成を
リクエストでき、「数値解析」ページで公開数の推移、「設定」ページで1日あたりの自動生成本数(0にすると自動
生成なし)・コスト上限を調整できる。全体設定・CTA・参考記事・画像・ターゲットは「コンテンツ設計」配下にまとまっている。

**手動生成した記事はAIの査読結果に関わらずCMSへ直接反映されない。** 生成が完了すると
`data/manual-review-queue.json` の確認待ちキューに追加され、管理画面の「確認待ち」ページで
内容(本文プレビュー・AI査読スコア/コメント)を人間が確認したうえで「CMSに反映する」を押した記事だけが
実際にmicroCMSへ公開される（`.github/workflows/publish-approved.yml` が反映を担当）。「却下する」を押すと
CMSには一切触れずキューから削除される。自動実行(毎日07:00 JST)は従来通り、査読ゲートの判定に基づき
自動公開／下書き保存／差し戻しを行う(この確認待ちフローは手動生成のみが対象)。

管理画面を使わない場合、GitHub Actionsの「Run workflow」画面からも直接同じことができる。
「Actions」タブ →「Daily Content Pipeline」→「Run workflow」を開くと、以下の入力欄が出る。

- **keyword**: 記事にしたいキーワードを直接指定する。指定すると情報収集エージェントをスキップし、そのキーワードだけで生成する。カンマ区切りで複数指定すると、キーワードごとに1本ずつまとめて生成する
- **cta_id**: 使いたいCTAの`id`（[`config/ctas.json`](./config/ctas.json)参照。idは管理画面で追加した際に自動採番される）を指定すると、そのCTAを必ず使う。カンマ区切りで複数指定すると、その中からAIが記事内容に合うものを選ぶ。keywordを空にしてcta_idを1つだけ指定すると、そのCTAへ自然につながる記事テーマをAIが逆算して1本提案・生成する（「CTAから逆算」運用）
- **source_urls**: 参考にしてほしいURL（カンマ区切り、任意）
- **notes**: その他記事に盛り込んで欲しい内容(自由記述、任意)。ライティングエージェントへの追加指示として渡る
- **target**: 想定読者・ターゲット属性(自由記述、任意)。管理画面の「ターゲット」で登録したプロフィールの説明文、または自由記述をそのまま渡す

すべて空欄のまま実行すれば、通常の自動収集(1日あたりの生成本数の設定はそのまま)で実行される。
毎日07:00 JSTの自動cronはこれらの入力を使わず、常に自動収集モードで動く(管理画面の「設定」で
1日あたりの生成本数を0にしている間は、ジョブ自体は起動するがAI呼び出し・記事生成は一切行わず終了する。
手動実行(workflow_dispatch)は本数設定に関わらずいつでも動く)。

生成本数の推移は管理画面の「数値解析」ページで確認できる。CTAのクリック率・記事の閲覧率などのアクセス解析は
優先度が低いため後回し(将来的にサイト側にGA4等の計測を入れたうえで別途対応する想定)。

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

- `.github/workflows/daily-content.yml`: 毎日07:00 JSTに記事生成・公開まで実行する（`DAILY_ARTICLE_COUNT`が0の間はAI呼び出しを行わず終了、手動実行は本数設定に関わらず常に動く）。
- `.github/workflows/daily-notify.yml`: 毎日21:00 JSTに、その日の自動実行結果をまとめて1通のSlackメッセージとして送信する（自動実行はリアルタイム通知しない。手動実行は従来通り即時通知）。
- `.github/workflows/weekly-report.yml`: 毎週月曜21:10 JSTに、直近7日間の集計とリライト候補をSlackに送信する。
- `.github/workflows/publish-approved.yml`: 管理画面の「確認待ち」で承認された手動生成記事を、管理画面から`queue_id`付きでworkflow_dispatchされてCMSへ反映する(常に即時公開)。

以下をリポジトリのSecrets/Variablesに登録すること:

- Secrets: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `MICROCMS_SERVICE_DOMAIN`, `MICROCMS_API_KEY`, `SLACK_WEBHOOK_URL`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_DRIVE_FOLDER_ID`
- Variables: `MICROCMS_ARTICLES_ENDPOINT`, `MICROCMS_KEYWORDS_ENDPOINT`, `COMPETITOR_RSS_FEEDS`, `DAILY_ARTICLE_COUNT`（管理画面の「設定」から自動更新、0で自動生成なし）, `DAILY_API_CALL_CAP`（同上）, `REVIEW_AUTO_PUBLISH_THRESHOLD`, `REVIEW_NEEDS_CHECK_THRESHOLD`, `PUBLISH_TARGET_NAME`, `REWRITE_THRESHOLD_DAYS`(任意、既定90)

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
