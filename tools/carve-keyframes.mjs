#!/usr/bin/env node
// ヒーロー大見出しの「削り出し」演出用 @keyframes を生成する。
// 詳しい使い方は tools/README.md を参照。
//
//   node tools/carve-keyframes.mjs                  … 8段で生成して画面に表示
//   node tools/carve-keyframes.mjs --passes 12      … 段数を変えて表示
//   node tools/carve-keyframes.mjs --passes 12 --write
//                                                   … css/style.css の目印の間を書き換える
//
// 生成するもの
//   carve-pass … 見出しの切り抜き（clip-path）。上から N 段に分け、段ごとに左→右／右→左と往復して見える範囲を広げる
//   carve-tip  … 刃先の光る線の位置。carve-pass と同じタイミングで動く
// 速さ（秒数）は CSS 側の変数 --carve-pass-duration などで変える。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const passesIndex = args.indexOf('--passes');
const passes = passesIndex >= 0 ? Number(args[passesIndex + 1]) : 8;
const write = args.includes('--write');

if (!Number.isInteger(passes) || passes < 1 || passes > 40) {
  console.error('--passes には 1〜40 の整数を指定してください');
  process.exit(1);
}

// 外枠は見出しの箱より少し広く取り、文字のはみ出し（「&」の左端や下端など）が切れないようにする
const EDGE = { left: -2, right: 102, top: -5, bottom: 105 };
// 段の切り替えは、同じ時刻に2つのキーフレームを置くと補間されずに一瞬で切り替わる
const JUMP = 0.001;

const pct = (n) => `${+n.toFixed(3)}%`;

// 見えている範囲 = 「それまでの段（上の長方形）」＋「今の段の x0〜x1 の部分」
// 頂点の並びを常に同じにして、clip-path の補間が崩れないようにする
const polygon = (a, b, x0, x1) => {
  const p = [
    [EDGE.left, EDGE.top], [EDGE.right, EDGE.top],
    [EDGE.right, a], [x1, a],
    [x1, b], [x0, b],
    [x0, a], [EDGE.left, a],
  ];
  return `polygon(${p.map(([x, y]) => `${pct(x)} ${pct(y)}`).join(', ')})`;
};

const rowTop = (i) => (i === 0 ? EDGE.top : (i / passes) * 100);
const rowBottom = (i) => (i === passes - 1 ? EDGE.bottom : ((i + 1) / passes) * 100);
const rowCenter = (i) => ((i + 0.5) / passes) * 100;

const clipFrames = [];
const tipFrames = [];

for (let i = 0; i < passes; i++) {
  const a = rowTop(i);
  const b = rowBottom(i);
  const start = (i / passes) * 100 + (i === 0 ? 0 : JUMP);
  const end = ((i + 1) / passes) * 100;
  const leftToRight = i % 2 === 0;

  if (leftToRight) {
    clipFrames.push([start, polygon(a, b, EDGE.left, EDGE.left)]);
    tipFrames.push([start, `left: 0%; top: ${pct(rowCenter(i))};`]);
    tipFrames.push([end, `left: 100%; top: ${pct(rowCenter(i))};`]);
  } else {
    clipFrames.push([start, polygon(a, b, EDGE.right, EDGE.right)]);
    tipFrames.push([start, `left: 100%; top: ${pct(rowCenter(i))};`]);
    tipFrames.push([end, `left: 0%; top: ${pct(rowCenter(i))};`]);
  }
  clipFrames.push([end, polygon(a, b, EDGE.left, EDGE.right)]);
}

const block = (name, frames) =>
  `@keyframes ${name} {\n${frames
    .map(([t, v]) => `  ${pct(t)} { ${v.startsWith('polygon') ? `clip-path: ${v};` : v} }`)
    .join('\n')}\n}`;

const START = '/* carve-keyframes:start */';
const END = '/* carve-keyframes:end */';
const css = [
  START,
  `/* tools/carve-keyframes.mjs で生成（${passes}段）。手で編集せず、スクリプトで作り直す */`,
  block('carve-pass', clipFrames),
  '',
  block('carve-tip', tipFrames),
  END,
].join('\n');

if (!write) {
  console.log(css);
  process.exit(0);
}

const cssPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'css', 'style.css');
const source = fs.readFileSync(cssPath, 'utf8');
const from = source.indexOf(START);
const to = source.indexOf(END);
if (from < 0 || to < 0) {
  console.error(`css/style.css に目印 ${START} と ${END} が見つかりません`);
  process.exit(1);
}
fs.writeFileSync(cssPath, source.slice(0, from) + css + source.slice(to + END.length));
console.log(`css/style.css の @keyframes を ${passes} 段で書き換えました`);
