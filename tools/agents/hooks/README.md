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

Provisions a fresh worktree the first time it is entered. The check is cheap and idempotent: it calls `git rev-parse --show-toplevel` plus a single `existsSync` on `node_modules/`. It only triggers a full `provision()` (mise + pnpm) when the repo root lacks `node_modules`, which is only true for a brand-new worktree. In the already-installed main checkout the hook is a near-instant no-op.

### `pretooluse-check.ts` — PreToolUse

Runs before every tool call.

Blocks tool invocations that use forbidden package managers or test runners (e.g. `npm`, `yarn`, `npx`, `jest` directly) and requires `pnpm` / `vitest` instead.

### `stop-check.ts` — Stop

Runs when Claude Code is about to stop.

Executes `pnpm check --all` against all files changed since the base branch. If the check fails, the stop is blocked and Claude is prompted to fix the issues before finishing.

## Why hook command paths must use `$CLAUDE_PROJECT_DIR`

Hook commands run in the **current working directory** (the cwd at the time of the event). Relative paths like `node tools/agents/hooks/pretooluse-check.ts` therefore only work when cwd is the repo root.

Two situations move cwd off the repo root:

- **Worktrees** — `EnterWorktree` creates a checkout under `.claude/worktrees/` on the `main` branch (which does not have the hook scripts). The relative path resolves to a file that doesn't exist.
- **`cd`** — any plain directory change has the same effect.

The documented fix is to anchor paths to `$CLAUDE_PROJECT_DIR`, which always points to the project root where the session started (the main checkout that has both the scripts and `node_modules`). Node resolves the scripts' internal `./utils/*.ts` imports relative to the script file's location, so those continue to work regardless of cwd. The scripts themselves then operate on cwd — e.g. `pnpm check` and git commands run against the worktree.

In `.claude/settings.json` all commands are therefore written as:

```json
"command": "node \"$CLAUDE_PROJECT_DIR/tools/agents/hooks/<hook>.ts\""
```

The quotes around the variable are required because Claude Code expands shell variables in command strings.

## Shared utilities

- `utils/exec.ts` — thin wrapper around `execa` that redirects stdout/stderr to the terminal and sets `RENOVATE_AGENT_HOOK=1`.
- `utils/git.ts` — git helpers: `getChangedFiles()` (diff vs base branch) and `getRepoRoot(dir?)` (returns the work-tree root or `null`).
- `utils/provision.ts` — installs mise tools and pnpm dependencies for a given directory (or cwd if omitted). Used by both `sessionstart-check.ts` and `cwdchanged-check.ts`.
- `utils/schemas.ts` — Zod schemas for all hook input shapes.
- `utils/stdin.ts` — reads the full stdin payload sent by Claude Code.
- `utils/output.ts` — formats structured JSON output (e.g. `block()` for the Stop hook).
