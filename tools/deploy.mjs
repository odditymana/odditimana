// 公開用のアップロード（FTPS）
//   npm run build                 dist/ を作るだけ（ブラウザで確かめる用）
//   npm run deploy -- --dry-run   送るファイル・サーバーから消すファイル・触らないものの一覧を出すだけ
//   npm run deploy                dist/ を作って FTPS で送り、CLEAN_DIRS の中でサーバーにあって dist/ に無いファイルを消す
// 接続先は .env.deploy（Git の対象外。書き方は .env.deploy.example）
// 公開先の直下にはサブドメインのフォルダもあるので、消すのは CLEAN_DIRS の中だけ

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { minify as minifyHtml } from 'html-minifier-terser';
import { minify as minifyJs } from 'terser';
import { Client } from 'basic-ftp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

// 公開するもの。ここに無いもの（CLAUDE.md、tools など）はサーバーに上がらない
const PUBLIC = [
  'index.html',
  '404.html',
  'about',
  'works',
  'css',
  'js',
  'fonts',
  'images',
  'favicon.svg',
  'apple-touch-icon.png',
  '.htaccess',
];

// サーバーから消すものを探すのは、このフォルダの中だけ。直下のほかのもの（サブドメインのフォルダなど）には触らない
const CLEAN_DIRS = ['about', 'works', 'css', 'js', 'fonts', 'images'];

// 消す対象にこれが含まれていたら、何も消さずに止める（サブドメインのフォルダを守る）
const PROTECTED = '.odditimana.com';

// 消し残しがあったら送らない
const FORBIDDEN = ['<!--', '/*', 'TODO', 'FIXME', 'localhost', '_originals', '_reference'];

const args = process.argv.slice(2);
const BUILD_ONLY = args.includes('--build-only');
const DRY_RUN = args.includes('--dry-run');

// コメントだけを外す。変数名の書き換え・処理の書き換えはしない
async function stripJs(code) {
  const result = await minifyJs(code, {
    compress: false,
    mangle: false,
    format: { comments: false, beautify: true },
  });
  return result.code;
}

// CSS の圧縮の道具（csso）は @media not ((…) and (…)) を壊したので、コメントだけを自前で外す。
// 文字列（"…" '…'）の中の /* は残す。url( ) はすべて引用符つきで書いている
function stripCss(code) {
  let out = '';
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < code.length && code[j] !== c) j += code[j] === '\\' ? 2 : 1;
      out += code.slice(i, j + 1);
      i = j + 1;
    } else if (c === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2);
      if (end === -1) throw new Error('CSS のコメントが閉じていない');
      i = end + 2;
    } else {
      out += c;
      i++;
    }
  }
  return out.replace(/^[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n');
}

async function stripHtml(code) {
  return minifyHtml(code, {
    removeComments: true,
    // <script> と <style> の中身。属性（style="" など）はそのまま
    minifyJS: (text, inline) => (inline ? text : stripJs(text)),
    minifyCSS: async (text, type) => (type ? text : stripCss(text)),
  });
}

async function listFiles(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue; // .DS_Store など
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listFiles(full)));
    else out.push(full);
  }
  return out;
}

async function build() {
  await fs.rm(DIST, { recursive: true, force: true });
  const files = [];
  for (const name of PUBLIC) {
    const src = path.join(ROOT, name);
    const stat = await fs.stat(src);
    files.push(...(stat.isDirectory() ? await listFiles(src) : [src]));
  }

  const problems = [];
  for (const src of files) {
    const rel = path.relative(ROOT, src);
    const dest = path.join(DIST, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    const ext = path.extname(src);
    if (!['.html', '.js', '.css'].includes(ext)) {
      await fs.copyFile(src, dest);
      continue;
    }
    const code = await fs.readFile(src, 'utf8');
    const out =
      ext === '.html' ? await stripHtml(code) : ext === '.js' ? await stripJs(code) : stripCss(code);
    await fs.writeFile(dest, out);
    for (const word of FORBIDDEN) {
      if (out.includes(word)) problems.push(`${rel}：「${word}」が残っている`);
    }
  }

  if (problems.length) {
    console.error('コメントの消し残しがあるので止めました。\n' + problems.join('\n'));
    process.exit(1);
  }
  console.log(`dist/ を作りました（${files.length} ファイル）。消し残しはありません`);
  return files.map((src) => path.relative(ROOT, src).split(path.sep).join('/'));
}

// フォルダの一覧を読む。まだ無いフォルダ（初めての公開）は空として扱う
async function listRemote(client, dir) {
  try {
    return (await client.list(dir)).filter((e) => e.name !== '.' && e.name !== '..');
  } catch (err) {
    if (err.code === 550) return [];
    throw err;
  }
}

// サーバーにあって手元に無いものを探す。. で始まるもの（.htaccess など）は触らない
async function findExtra(client, remoteDir, localSet, rel) {
  const extra = [];
  for (const entry of await listRemote(client, path.posix.join(remoteDir, rel))) {
    if (entry.name.startsWith('.')) continue;
    const relPath = `${rel}/${entry.name}`;
    if (entry.isDirectory) {
      const used = [...localSet].some((f) => f.startsWith(relPath + '/'));
      if (used) extra.push(...(await findExtra(client, remoteDir, localSet, relPath)));
      else extra.push({ path: relPath, dir: true });
    } else if (!localSet.has(relPath)) {
      extra.push({ path: relPath, dir: false });
    }
  }
  return extra;
}

// 消す前にすべて確かめ、1つでもおかしければ何も消さずに止める
function checkExtra(extra, remoteDir) {
  const bad = extra.filter((e) => {
    const target = path.posix.join(remoteDir, e.path);
    const inCleanDir = CLEAN_DIRS.some((d) => e.path.startsWith(d + '/'));
    return !inCleanDir || target.includes(PROTECTED);
  });
  if (bad.length) {
    throw new Error(
      '消してはいけない場所が消す対象に入ったので止めました（何も消していません）。\n' +
        bad.map((e) => '  ' + e.path).join('\n')
    );
  }
}

// 直下で PUBLIC に無いもの（サブドメインのフォルダなど）。読むだけで、送りも消しもしない
async function findUntouched(client, remoteDir) {
  const out = [];
  for (const entry of await listRemote(client, remoteDir)) {
    if (PUBLIC.includes(entry.name)) continue;
    let note = '';
    if (entry.isDirectory && entry.name.endsWith(PROTECTED)) {
      const inside = await listRemote(client, path.posix.join(remoteDir, entry.name));
      note = inside.some((e) => e.name === '.htaccess') ? '（.htaccess あり）' : '（.htaccess なし）';
    }
    out.push('  ' + entry.name + (entry.isDirectory ? '/' : '') + note);
  }
  return out;
}

const files = await build();
if (BUILD_ONLY) process.exit(0);

process.loadEnvFile(path.join(ROOT, '.env.deploy'));
const { FTP_HOST, FTP_USER, FTP_PASSWORD, FTP_REMOTE_DIR } = process.env;
if (!FTP_HOST || !FTP_USER || !FTP_PASSWORD || !FTP_REMOTE_DIR) {
  console.error('.env.deploy に FTP_HOST・FTP_USER・FTP_PASSWORD・FTP_REMOTE_DIR を書いてください');
  process.exit(1);
}

const client = new Client();
try {
  await client.access({ host: FTP_HOST, user: FTP_USER, password: FTP_PASSWORD, secure: true });
  // ensureDir はフォルダが無いと作るので、dry-run では使わない（サーバーに何も書かない）
  if (!DRY_RUN) await client.ensureDir(FTP_REMOTE_DIR);
  const localSet = new Set(files);
  const extra = [];
  for (const dir of CLEAN_DIRS) extra.push(...(await findExtra(client, FTP_REMOTE_DIR, localSet, dir)));
  checkExtra(extra, FTP_REMOTE_DIR);

  if (DRY_RUN) {
    console.log(`\n送るファイル（${FTP_REMOTE_DIR} へ）：\n` + files.map((f) => '  ' + f).join('\n'));
    console.log(
      `\nサーバーから消すもの（調べた範囲：${CLEAN_DIRS.map((d) => d + '/').join(' ')}）：\n` +
        (extra.length ? extra.map((e) => '  ' + e.path + (e.dir ? '/' : '')).join('\n') : '  なし')
    );
    const untouched = await findUntouched(client, FTP_REMOTE_DIR);
    console.log(
      `\n触らないもの（直下で PUBLIC に無いもの。送りも消しもしない）：\n` +
        (untouched.length ? untouched.join('\n') : '  なし')
    );
  } else {
    await client.uploadFromDir(DIST, FTP_REMOTE_DIR);
    for (const e of extra) {
      const target = path.posix.join(FTP_REMOTE_DIR, e.path);
      if (e.dir) await client.removeDir(target);
      else await client.remove(target);
      console.log('消した：' + e.path + (e.dir ? '/' : ''));
    }
    console.log('送りました');
  }
} finally {
  client.close();
}
