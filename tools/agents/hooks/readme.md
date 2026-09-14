# Claude Code hooks

This directory contains hook scripts that Claude Code invokes automatically at key points in a session.

## Hooks

### `sessionstart-check.ts` — SessionStart

Runs once on session startup, resume, clear, or compact.

Installs tools and dependencies so the session has a working environment:

1. `mise install` — installs language runtimes declared in `.tool-versions` / `mise.toml`. Failure is non-fatal (logs a warning and continues) so the session works even without `mise`.
2. `pnpm install` — installs Node dependencies. Failure is fatal and blocks the session.

### `cwdchanged-check.ts` — CwdChanged

Runs on every working-directory change, including `EnterWorktree`.

Install tools and dependencies in the new cwd, so the session has a working environment even when switching to a different worktree or subdirectory.

### `pretooluse-check.ts` — PreToolUse

Runs before every tool call.

Blocks tool invocations that use forbidden package managers or test runners (e.g. `npm`, `yarn`, `npx`, `jest` directly) and requires `pnpm` / `vitest` instead.

### `stop-check.ts` — Stop

Runs when Claude Code is about to stop.

Executes `pnpm check --all` against all files changed since the base branch. If the check fails, the stop is blocked and Claude is prompted to fix the issues before finishing.
