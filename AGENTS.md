# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Use `pnpm` for all commands (not npm/npx).

- **Install dependencies:** `pnpm install`
- **Run single test file:** `pnpm vitest lib/modules/manager/npm/extract.spec.ts`
- **Run tests matching pattern:** `pnpm vitest -- --testPathPattern manager/npm`
- **Full test suite:** `pnpm test` (runs lint + schema validation + all tests)
- **Type-check:** `pnpm type-check`
- **Lint:** `pnpm lint`
- **Auto-fix lint/format:** `pnpm lint-fix`
- **Build:** `pnpm build` (generates code, compiles with tsdown, produces `dist/`)
- **Run from source:** `pnpm start` or `node lib/renovate.ts`

Tests use Vitest (invoked via `pnpm vitest`). Test files use `.spec.ts` suffix and are co-located with source. Globals from `jest-extended` and `expect-more-jest` are available in tests.

## Architecture

Renovate is an automated dependency update tool. The runtime flow is:

```
lib/renovate.ts → workers/global (orchestration, autodiscovery)
  → workers/repository (per-repo: init → extract → update → finalize)
    → modules/* (pluggable backends)
```

### Module System (`lib/modules/`)

Four module categories, each with many implementations:

- **manager/** — Detects and updates dependency files (npm, maven, dockerfile, go-mod, cargo, etc.). Each manager extracts dependencies from specific file types and knows how to update them.
- **datasource/** — Fetches version/release information from registries (npm registry, Docker Hub, GitHub releases, PyPI, etc.).
- **versioning/** — Parses and compares version strings per ecosystem (semver, docker, maven, pep440, etc.).
- **platform/** — Interacts with Git hosting APIs (GitHub, GitLab, Bitbucket, Azure DevOps, Gitea, Forgejo, Gerrit, etc.) for PRs, issues, and comments.

Each module category has an `api.ts` barrel file at its root.

### Other Key Directories

- **lib/config/** — Configuration parsing, validation, defaults, preset resolution
- **lib/util/** — Shared utilities (HTTP, git, caching, regex, template, etc.)
- **lib/workers/global/** — Top-level orchestration, autodiscovery, config loading
- **lib/workers/repository/** — Per-repository processing pipeline
- **lib/constants/** — Shared constants
- **tools/** — Build tooling, doc generation, schema generation, custom lint rules

### Generated Files

Files matching `*.generated.ts` in `lib/` are auto-generated during build (`pnpm generate:*`). Do not edit these directly.

## TypeScript

- Target: ES2024, module: NodeNext
- `tsdown` compiles to `dist/` for distribution; `tsc --noEmit` is used only for type-checking
- `isolatedModules: true` is required

## Contribution Requirements

All PRs that use AI assistance must disclose this in the PR description (per `.github/contributing.md` and the PR template).
