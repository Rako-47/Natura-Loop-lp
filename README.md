# Natura Loop DAILY BASE LP（課題用・架空ストア）

スマホ優先のキャンペーンLP（静的ファイル。タブレット・PCにも対応）＋ GAS購入フォーム ＋ GitHub Pages公開。

```
index.html            LP本体（直下）
favicon.ico           ファビコン（16・32・48px）。他は image/favicon.svg と image/apple-touch-icon.png（180px）
css/style.css         スタイル
js/config.js          差し替え用の設定（GAS_URL・GA_ID）
js/main.js            UI・金額計算・計測・購入フォーム送信
image/                画像（ogp.png はSNSシェア用 1200×630／hero-pc.webp はPC用の横長ヒーロー 1920×720。ロゴ・こだわり画像はWebP。howto.webp は飲み方セクションの写真）
.nojekyll             GitHub PagesでJekyll処理をしないための空ファイル（削除しない）
gas-code.gs           GASに貼るコード（Google Apps Scriptで動くため、サイトには公開されません）
```

公開は GitHub Pages の「Deploy from a branch」（main／root）です。リポジトリ直下のファイルがそのままサイトになるため、`gas-code.gs` と `README.md` もURLで見える状態になります（秘密情報は入っていません。シートIDはGASのスクリプトプロパティに入れます）。

## 1. 差し替え箇所（これだけ設定すれば動きます）

| 場所 | 項目 | 内容 |
|---|---|---|
| `js/config.js` | `GAS_URL` | GASのウェブアプリURL（`…/exec`） |
| `js/config.js` | `GA_ID` | GA4測定ID（空なら `dataLayer` への記録のみ） |
| `index.html` | `YOUR_GITHUB_USER` / `YOUR_REPO` | `canonical`・`og:url`・`og:image` のURL（3か所） |
| `image/ogp.png` | OGP画像 | 作成済み（1200×630px）。差し替える場合は同じ名前・サイズで上書き |
| GASのスクリプトプロパティ | `SHEET_ID` ほか | 下記 2. 参照 |

## 2. GASの設定

1. Googleスプレッドシートを新規作成し、URLの `/d/` と `/edit` の間の文字列（ID）を控える。
2. 拡張機能 → Apps Script を開き、`gas-code.gs` の内容を `Code.gs` に貼る。
3. プロジェクトの設定 → スクリプトプロパティに追加：
   - `SHEET_ID`（必須）
   - `ADMIN_EMAIL`（任意：注文通知の送信先）
   - `REPLY_TO`（任意）
   - `MAIL_DAILY_LIMIT`（任意：メール送信の1日の上限。未設定なら80）
   - `TEST_MODE` = `true`（動作確認中のみ。キャンペーン期間チェックを無効化）
4. 関数 `setup` を1回実行し、権限を承認する（シートの見出しが作られる）。
5. デプロイ → 新しいデプロイ → 種類「ウェブアプリ」→ 実行ユーザー「自分」、アクセスできるユーザー「全員」→ 表示された `…/exec` のURLを `config.js` の `GAS_URL` に設定する。
6. コードを変えたときは「デプロイを管理 → 新バージョン」で再デプロイする（URLは変わらない）。
7. **公開前に `TEST_MODE` を削除または `false` にする。**（今日時点ではキャンペーン開始前のため、`false` だとコードは「2026年11月1日から開始」と表示されます）

注意：無料アカウントのメール送信は1日約100通まで。シートの共有は自分のみにする。本LPは課題用で、決済は行わず、カード情報の入力欄もありません。実在の個人情報は入力しないでください。

### メール送信の上限

- 送信数は日本時間の日付ごとに数えます（`MAIL_COUNT` というスクリプトプロパティに「日付:通数」で保存。手で変更しない）。
- 合計が `MAIL_DAILY_LIMIT`（既定80通）に達すると、**顧客宛の確認メールは送らず**、注文だけ受け付けます（シートの「メール送信」列は `SKIP`、完了画面には案内を表示）。
- `ADMIN_EMAIL` への通知は上限を超えても送ります（Googleの残り枠がある間だけ。未送信の注文も把握できます）。
- 上限を変えたいときは `MAIL_DAILY_LIMIT` を書き換えるだけで、再デプロイは不要です。

## 3. GitHubで公開（Deploy from a branch）

```bash
git init -b main
git add .
git commit -m "Initial commit: Natura Loop LP"
git remote add origin https://github.com/<USER>/<REPO>.git
git push -u origin main
```

1. リポジトリの Settings → Pages → Build and deployment → Source を **Deploy from a branch** にする。
2. Branch を **main**、フォルダを **/(root)** にして Save する。
3. 数分後、`https://<USER>.github.io/<REPO>/` で公開される（Actions タブの「pages build and deployment」が成功すれば完了）。
4. 更新するときは、ファイルを変更して `git push` するだけ。

## 4. テスト手順（TEST_MODE=true）

| ケース | 期待結果 |
|---|---|
| コードあり＋カード | 合計3,466円 |
| コードあり＋コンビニ後払い | 合計3,686円 |
| コードなし＋カード | 合計3,790円 |
| 同じメール／同じ住所で2回目にコード | 「初めてご購入の方が対象」→ コードを外して通常価格で購入できる |
| `TEST_MODE=false` で期間外 | 「2026年11月1日から開始」／「終了しました」 |
| 必須未入力・形式エラー | 項目ごとのエラー、最初のエラー項目へフォーカス |
| 注文後 | シートに1行追加、確認メール、`purchase` イベント |
| `MAIL_DAILY_LIMIT` を `1` にして2件注文 | 1件目は確認メールあり、2件目は注文のみ受付（`SKIP`・完了画面に案内）。管理者通知は2件とも届く |

## 5. 実装メモ

- 購入ボタンはすべて同じダイアログ（`#order`）を開き、コード `BASE10` を自動入力します。`?coupon=BASE10` のURLでも同じ動作です。
- 金額はGASが再計算します（クライアントの値は表示用）。
- 計測イベント：`cta_click_buy`（`position`＝fv／mid1／mid2／sticky／final）、`code_copy`、`contact_click`、`begin_checkout`、`coupon_apply`、`purchase`、`newsletter_signup`。
- 写真は読み込みを軽くするため WebP（`hero` `nutri` `tablet` `nature`）にしています。
- 郵便番号からの住所自動入力は、外部APIの仕様確認が必要なため実装していません（手入力）。

### 画面幅ごとの表示とアニメーション

- 〜767px：スマホ（従来どおり）。768〜1023px：タブレット（幅720pxの1カラム）。1024px〜：PC（内容幅1120px・各セクションを2〜4カラムに組み直し）。
- PCでは、ヘッダーを上部に固定してナビと購入ボタンを表示し、追従バーは出しません。注文ダイアログは中央のカード（幅600px）になります。
- ファーストビューは `<picture>` で出し分けています。スマホ・タブレットは `hero.webp`（文字入り）、PCは `hero-pc.webp`（文字なし）に、見出し（h1）・価格・ボタンを実テキストで重ねます。スマホではh1を画面外に置いて、読み上げ・検索用に残しています。
- アニメーション：ファーストビューは読み込み時に上からフェードイン（CSS）。以降の要素は、HTMLの `data-reveal` 属性を付けた要素がスクロールで下からフェードアップします（`main.js` の IntersectionObserver）。購入ボタンは数秒おきに光が走ります。
- 動きを減らす設定（`prefers-reduced-motion`）では、すべて止めて最初から表示します。JSが動かないときは、3.5秒後にすべて表示します。
- 新しい要素にフェードアップを付けたいときは、タグに `data-reveal` を足すだけです。

## 6. 公開直前チェック

```bash
grep -rn "YOUR_" index.html js/   # 何も出なければ、canonical / og:url / og:image の差し替え済み
ls image/ogp.png                  # ファイルがあればOK
grep -n "noindex" index.html      # 検索に載せたいなら、この行を削除
```

- GASの `TEST_MODE` を削除、または `false` にして再デプロイし、購入テストをやり直す。
- 公開後、OGP画像をシェアデバッガーなどで確認する。
