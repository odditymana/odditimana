# tools

## carve-keyframes.mjs

トップページのヒーローで、大見出しを「削り出す」演出に使う `@keyframes` を生成するスクリプトです。

大見出しを上から N 段に分け、1段ごとに左→右、次の段は右→左…と、工具が往復するように見える範囲を広げます。生成するのは次の2つです。

- `carve-pass`：大見出しの切り抜き（`clip-path: polygon()`）
- `carve-tip`：刃先の光る線の位置（`carve-pass` と同じタイミングで動く）

Node.js（v18 以降）があれば動きます。追加のインストールは必要ありません。

### 段数を変える

```sh
# 生成結果を画面に表示するだけ（ファイルは変わらない）
node tools/carve-keyframes.mjs --passes 12

# css/style.css の目印の間を書き換える
node tools/carve-keyframes.mjs --passes 12 --write
```

- `--passes` を省略すると 8 段になります（1〜40 の範囲で指定できます）。
- 書き換えるのは、`css/style.css` の中の `/* carve-keyframes:start */` から `/* carve-keyframes:end */` までです。この範囲は手で編集せず、スクリプトで作り直してください。

### 速さを変える

速さは生成した `@keyframes` ではなく、`css/style.css` の `.hero` に書いた変数で調整します。

| 変数 | 意味 | 初期値 |
|---|---|---|
| `--carve-delay` | ページを開いてから削り始めるまでの待ち時間 | `0.3s` |
| `--carve-pass-duration` | 全段を削り終えるまでの時間 | `1.6s` |
| `--carve-finish-duration` | 削り跡の細い線が埋まり、くっきり完成するまでの時間 | `0.5s` |

演出全体の長さは、この3つの合計（初期値では 2.4 秒）です。

段数を増やしても `--carve-pass-duration` が同じなら、全体の時間は変わらず、1段あたりが速くなります。
