# AGENTS.md

This file provides guidance for AI agents working in this repository.

## What is Renovate?

Renovate is an automated dependency update tool that scans repositories for dependency files, checks for newer versions via datasources, and creates pull requests to update them. It supports 90+ package managers and multiple hosting platforms (GitHub, GitLab, Bitbucket, Azure DevOps, Gitea, Forgejo, Gerrit, etc.).

## Development Documentation

The **./docs/development/** directory contains detailed documentation for developers, like style guides, testing guidelines, and configuration options.

ALWAYS READ ./docs/development/best-practices.md for guidance on code style.

## Architecture

Renovate is an automated dependency update tool. The runtime flow is:

```mermaid
flowchart TD
    entry["lib/renovate.ts\nEntry Point"]
    global["Global Worker\nOrchestration & Autodiscovery"]
    init["Init\nClone repo, read config"]
    extract["Extract\nScan dependency files"]
    lookup["Lookup\nFetch versions & compare"]
    update["Update\nWrite changes, create PRs"]
    finalize["Finalize\nPrune branches, update cache"]

    platform([Platform])
    manager([Manager])
    datasource([Datasource])
    versioning([Versioning])

    entry --> global
    global --> init
    init --> extract
    extract --> lookup
    lookup --> update
    update --> finalize

    global -. "autodiscover repos" .-> platform
    init -. "clone, read config" .-> platform
    extract -. "parse dep files" .-> manager
    lookup -. "fetch releases" .-> datasource
    lookup -. "compare versions" .-> versioning
    update -. "update dep files" .-> manager
    update -. "create/update PRs" .-> platform
    finalize -. "prune branches" .-> platform
    finalize -- "next repository" --> init
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

## Raising issues/feature requests

**Do not create GitHub Issues directly.** Issue creation is restricted to repository administrators. Creating an issue as a non-administrator will result in being blocked from the repository.

Instead, use **GitHub Discussions**: https://github.com/renovatebot/renovate/discussions/new/choose

Two discussion categories are available:

- **Request help** (`.github/DISCUSSION_TEMPLATE/request-help.yml`) - for bugs, questions, or unexpected behavior. Include a minimal reproduction and relevant logs where possible.
- **Suggest an idea** (`.github/DISCUSSION_TEMPLATE/suggest-an-idea.yml`) - for feature requests or improvements.

**Do not attempt** to create a Discussion body without following the template, as it may result in being blocked from the repository.

**Security vulnerabilities must not be reported on GitHub.** See [`SECURITY.md`](./SECURITY.md) for more details.

## Contributing Notes

- PRs require 100% test coverage. Use `/* v8 ignore ... */` sparingly when tests wouldn't prove anything.
- Do not force push PR branches.
- Follow the PR template (`.github/pull_request_template.md`). Before running `gh pr create`, read that file in full and use its exact section structure for the PR body — do not substitute a generic Summary/Test plan format.
- PRs should be raised as a draft PR, and only marked ready once the CLA has been signed, and the user has confirmed that the changes are ready to go

### Commands

Use `pnpm` for all commands (NOT npm/npx).

- **Install dependencies:** `pnpm install`
- **Lint / Type-check / Test / Autofix:** `pnpm check --all <paths>` for the changed files, `pnpm check --all` without a path for a full verification. It already runs lint, prettier, type-check and the tests of those files, so do not run `pnpm type-check`, `tsc`, a separate lint or extra `pnpm vitest` runs next to it.
- **Run from source:** `pnpm start` or `node lib/renovate.ts`

Tests use Vitest (invoked via `pnpm vitest`). Test files use `.spec.ts` suffix and are co-located with source. Globals from `jest-extended` and `expect-more-jest` are available in tests.

### Code conventions

These add to [`docs/development/best-practices.md`](./docs/development/best-practices.md):

- Spec files have exactly one root `describe`, named by the file path (e.g. `describe('workers/repository/process/extract-update', ...)`); nest any grouping inside it.
- Write multi-line fixtures inline with the `codeBlock` helper and real indentation, not as joined arrays and not as new `__fixtures__` files.
- Never put `await` inside a ternary or other conditional expression; use `if`/`else`, as V8 coverage misreports such constructs.
- Prefer branch-free forms such as `.filter(isTruthy)` or `flatMap` over `if (!x) continue` in loops; each explicit branch needs its own test for full coverage.
- Keep TSDoc to a factual statement of what a function does, without explanatory prose paragraphs.
- Build strings with template literals rather than `+` in code you add or rewrite.
- Do not remove existing `/* v8 ignore ... */` comments; document why the branch is unreachable instead. Before adding one, try to construct an input that reaches the branch, and prefer a real test.
