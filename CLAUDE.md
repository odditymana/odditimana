# CLAUDE.md

## 進め方

- 回答は日本語で書き、専門用語には短い説明を添える
- 作業の前に手順を見せて、確認を待ってから進める
- コミットと push は、指示があるまで行わない

## 制作のルール

- バニラ（HTML・CSS・JavaScript のみ。フレームワークは使わない）で制作する
- 色・フォント・余白は `css/style.css` の CSS 変数（`:root` で定義しているもの）を使う
- 動きを減らす設定（`prefers-reduced-motion`）とキーボード操作に配慮する
- 元画像は `_originals/` に残し、`images/` には WebP を置く

## 公開の手順

- 公開は `npm run deploy` だけで行う（FTP ソフトで直接アップロードしない）
- 公開は指示があるまで行わない。先に `npm run deploy -- --dry-run` の結果を見せて、確認を待つ
- 公開するファイルやフォルダを増やしたら、`tools/deploy.mjs` の `PUBLIC` に足す
- `.htaccess` を変えたら、公開の前に手元の Apache で、構文のエラーとサブドメインへの影響がないことを確かめる
