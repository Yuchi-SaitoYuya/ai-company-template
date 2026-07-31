#!/usr/bin/env node
// 会社のオフィスを開く。社員（サブエージェント）が働く様子をブラウザで見られる。
//
// 使い方: node office/start.js
// ポートを変える: node office/start.js 3200
// 止めるとき: このターミナルで Ctrl-C
//
// Windows / macOS / Linux のどれでも動く（実行権限も bash も要らない）。

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const OFFICE_DIR = __dirname;
// 監視するプロジェクトは起動時のフォルダで決まる。ここを間違えると別の
// プロジェクトを見に行ってしまうので、必ず会社のフォルダ（office の1つ上）で動かす。
const COMPANY_DIR = path.dirname(OFFICE_DIR);

const port = process.argv[2] || '3100';
const isWindows = process.platform === 'win32';

// ── Node の確認 ──
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < 20) {
  console.error(`Node.js 20 以上が必要です（今: ${process.version}）`);
  console.error('https://nodejs.org からインストールしてください');
  process.exit(1);
}

// ── 初回だけ、実行に必要な4つの部品を入れる ──
if (!fs.existsSync(path.join(OFFICE_DIR, 'node_modules'))) {
  console.log('初回の準備をします（30秒ほどかかります）...');
  const npm = isWindows ? 'npm.cmd' : 'npm';
  const install = spawnSync(
    npm,
    ['install', '--omit=dev', '--no-audit', '--no-fund', '--loglevel=error'],
    { cwd: OFFICE_DIR, stdio: 'inherit', shell: isWindows },
  );
  if (install.status !== 0) {
    console.error('準備に失敗しました。office フォルダで npm install --omit=dev を試してください');
    process.exit(1);
  }
  console.log('準備ができました');
}

// ── 近未来レイアウトを置く（すでに自分のレイアウトがある人は触らない） ──
const layoutDir = path.join(require('os').homedir(), '.pixel-agents');
const layoutDest = path.join(layoutDir, 'layout.json');
if (!fs.existsSync(layoutDest)) {
  fs.mkdirSync(layoutDir, { recursive: true });
  fs.copyFileSync(path.join(OFFICE_DIR, 'layout.json'), layoutDest);
  console.log(`レイアウトを置きました: ${layoutDest}`);
} else {
  console.log('既存のレイアウトを使います（付属のものに差し替えるなら office/README.md を参照）');
}

console.log('');
console.log(`オフィスを開きます。ブラウザで http://127.0.0.1:${port} を開いてください。`);
console.log('この状態のまま、別のターミナルで claude を起動して /kickoff を流すと社員が席に着きます。');
console.log('');

const child = spawn(process.execPath, [path.join(OFFICE_DIR, 'dist', 'cli.js'), '--port', port], {
  cwd: COMPANY_DIR,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  process.exit(signal ? 1 : (code ?? 0));
});
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => child.kill(sig));
}
