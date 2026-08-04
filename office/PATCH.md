# 同梱ビルドに当てている修正（3件）

素の Pixel Agents v1.4.0 では、**この会社の社員が1人も画面に出ません。**
秘書（メインエージェント）だけが1人で座っているように見えます。

原因は Pixel Agents 側の不具合ではなく、**Claude Code のログの持ち方が変わった**ことに
追いついていない箇所が3つあったためです。実測で確認した内容を残します。

差分の全文は `PATCH.diff`（5ファイル・119行）。ベースは上流 `f6cdd2d`（2026-07-25）です。

---

## 1. 一時サブエージェントが1体も出ない

**症状**: `/kickoff` でリサーチ社員3人が働いても、画面には秘書1人しか出ない。

**原因**: 子キャラを作る `subagentToolStart` が2経路とも発火しませんでした。

| 経路 | 期待している形 | 実際 |
|---|---|---|
| JSONL | 親ログの中に `parentToolUseID` 付き `progress` レコードが混ざる | 親ログに `progress` は **0件**。サブエージェントの記録は別階層 `<session-id>/subagents/agent-*.jsonl` に分離されていた |
| hook | `SubagentStart` の時点で親の `Agent` ツールが `activeToolNames` に登録済み | ログの順序は `PreToolUse` → **`SubagentStart`** → `JSONL: tool start`。`activeToolNames` を埋めるのは JSONL パーサだけなので、間に合っていない |

**修正**: `hookEventHandler.ts` の `handleSubagentStart` で、親が見つからないときに捨てる代わりに
**0.5秒間隔で最大10回リトライ**し、JSONL が登録した本物の親 ID（`toolu_...`）に紐づけます。
親 ID を合わせているので、既存の片付け処理（`subagentClear`）がそのまま効きます。

**検証**: `subagentToolStart` が3体分流れ、終了時に `subagentClear` が出て残留なし。

---

## 2. 常駐チームメイトが出ない（常駐モードのみ関係）

**症状**: 社員を名前付き＋バックグラウンドで呼んでも、席に残らない。

**原因**: 常駐キャラの生成条件は `provider.team && currentHookIsTeammateSpawn && agent.teamName` の3つ。
このうち `agent.teamName` を設定する経路が1つしかなく（`transcriptParser.ts`、親ログのレコード最上位に
`teamName` フィールドがあることを期待）、**実際の親ログで最上位に `teamName` を持つレコードは0件**でした。
本物のチーム情報は `~/.claude/teams/<team>/config.json` にあり、そこに `leadSessionId` が入っています。

**修正**: `claudeTeamProvider.ts` に `findTeamByLeadSessionId()` を追加し、
`~/.claude/teams/*/config.json` を走査して `leadSessionId` 一致でチーム名を返します。
`hookEventHandler.ts` からは **`teamName` が空のときだけ**引くので、チームを持たない無関係な
セッションは従来どおり一時サブエージェント扱いのままです。

---

## 3. 秘書に `LEAD` の名札が付かない

**症状**: ラベルを常時表示にしても、秘書と社員の区別が付かない。

**原因**: 名札は `ch.isTeamLead ? 'LEAD' : ch.agentName` で決まりますが（`ToolOverlay.tsx`）、
2番の修正でチームを解決した直後に `linkTeammates()` を呼んでおらず、誰も lead として印が付きませんでした。

**修正**: `transcriptParser.ts` の `linkTeammates` を export し、チーム解決の直後に呼びます
（JSONL 経路がやっているのと同じ処理）。

---

## 検証状況

- `npx tsc --noEmit` 通過
- サーバーのテスト **278件すべて通過**（19ファイル）
- 実機で `subagentToolStart` ×3・`agentTeamInfo`（`isTeamLead=true`）・`subagentClear` を確認

## 上流に取り込まれた場合

`office/` は不要になります。公式の VS Code 拡張、または `npx pixel-agents` に置き換えてください。
その際 `office/layout.json` はそのまま使えます（`~/.pixel-agents/layout.json` に置く）。

## 自分でビルドし直したいとき

```bash
git clone https://github.com/pixel-agents-hq/pixel-agents.git
cd pixel-agents && git checkout f6cdd2d
git apply /path/to/ai-company-template/office/PATCH.diff
npm install
npm run asyncapi:generate && node esbuild.js --production && npm run build:webview
# 出来上がった dist/ を office/dist/ に置き換える
```
