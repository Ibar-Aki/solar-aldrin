# Push Policy (Explicit User Instruction Only)

作成日時: 2026-02-08T21:37:06+09:00
作成者: Codex+GPT-5

## 目的
このリポジトリでは、ユーザーが **明示的に push を依頼した場合のみ** `git push` を許可します。

Codex / Antigravity など複数のLLMツールから編集する前提でも、同じ手順で push 可否を揃えられるようにしています。

## 仕組み（強制）
`.githooks/pre-push` が push をブロックします。

push を通すには、以下の **両方** を満たす必要があります。

- `ALLOW_PUSH=1`
- `EXPLICIT_PUSH=1`

ツール別エイリアス（どれか1つで `EXPLICIT_PUSH=1` 扱い）:
- `CODEX_EXPLICIT_PUSH=1`
- `ANTIGRAVITY_EXPLICIT_PUSH=1`

## セットアップ（各環境で1回）
このリポジトリのクローン先で、フックパスを有効化します。

```sh
git config core.hooksPath .githooks
```

確認:

```sh
git config --get core.hooksPath
```

## push 実行例（ユーザーが明示依頼したときだけ）
### PowerShell（Windows）
```powershell
$env:ALLOW_PUSH="1"
$env:EXPLICIT_PUSH="1"           # もしくは $env:CODEX_EXPLICIT_PUSH="1" / $env:ANTIGRAVITY_EXPLICIT_PUSH="1"
git push origin main
Remove-Item Env:ALLOW_PUSH,Env:EXPLICIT_PUSH -ErrorAction SilentlyContinue
```

### bash / zsh（macOS/Linux）
```bash
ALLOW_PUSH=1 EXPLICIT_PUSH=1 git push origin main
```

## ユーザーへの依頼文テンプレ（推奨）
ユーザーが「明示的にpushを依頼した」ことを機械的に判定できるよう、以下の形で依頼してもらうと運用が安定します。

```
PUSHしてください: remote=origin branch=main
```

