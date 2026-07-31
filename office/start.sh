#!/bin/bash
# 会社のオフィスを開く。社員（サブエージェント）が働く様子をブラウザで見られる。
#
# 使い方: ./office/start.sh
# 止めるとき: このターミナルで Ctrl-C
set -e

# このスクリプトの1つ上（＝会社のフォルダ）で動かす。
# 監視するプロジェクトは実行時のフォルダで決まるので、ここを間違えると
# 別のプロジェクトを見に行ってしまう。
OFFICE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPANY_DIR="$(dirname "$OFFICE_DIR")"
cd "$COMPANY_DIR"

PORT="${1:-3100}"

# ── Node の確認 ──
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js が見つかりません。https://nodejs.org からインストールしてください（20 以上）"
  exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Node.js 20 以上が必要です（今: $(node -v)）"
  exit 1
fi

# ── 初回だけ、実行に必要な4つの部品を入れる（3秒ほど） ──
if [ ! -d "$OFFICE_DIR/node_modules" ]; then
  echo "初回の準備をします（30秒ほどかかります）..."
  (cd "$OFFICE_DIR" && npm install --omit=dev --no-audit --no-fund --loglevel=error)
  echo "準備ができました"
fi

# ── 近未来レイアウトを置く（すでに自分のレイアウトがある人は触らない） ──
LAYOUT_DEST="$HOME/.pixel-agents/layout.json"
if [ ! -f "$LAYOUT_DEST" ]; then
  mkdir -p "$HOME/.pixel-agents"
  cp "$OFFICE_DIR/layout.json" "$LAYOUT_DEST"
  echo "レイアウトを置きました: $LAYOUT_DEST"
else
  echo "既存のレイアウトを使います（付属のものに差し替えるなら office/README.md を参照）"
fi

echo
echo "オフィスを開きます。ブラウザで http://127.0.0.1:$PORT を開いてください。"
echo "この状態のまま、別のターミナルで claude を起動して /kickoff を流すと社員が席に着きます。"
echo

exec node "$OFFICE_DIR/dist/cli.js" --port "$PORT"
