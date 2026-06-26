# pnpm lockfile minimumReleaseAge retry (upstream candidate)

## Problem

Repositories that set pnpm `minimumReleaseAge` (e.g. 7 days) often also land **security-approved** young pins on the default branch via one-shot bypass or frozen installs. Renovate then fails `pnpm install --lockfile-only` during artifact update with `ERR_PNPM_NO_MATURE_MATCHING_VERSION` for packages **already in the base lockfile**, producing manifest-only PRs and red frozen CI.

This matches community reports (renovatebot/renovate#39999 and related maturity/exclude issues).

## Approach

Mirror npm's retry-without-`--before` when the lockfile already contains packages newer than Renovate's cooldown:

1. Capture pre-update `pnpm-lock.yaml` content (before lockFileMaintenance delete).
2. Run pnpm lockfile commands as today.
3. On `ERR_PNPM_NO_MATURE_MATCHING_VERSION`, parse package + version from stderr.
4. If that `package@version` is **already in the pre-update lockfile**, OR the upgrade set includes a **vulnerability alert** targeting that version, retry with CLI-only:
   `--config.minimumReleaseAgeExclude[]=name@version`
5. Repeat until success, non-maturity error, or retry limit (15).
6. Surface `maturityFallback` + artifact notice (like `beforeFallback` for npm).

**Does not** disable maturity for brand-new selections not on the base branch (still fails closed).

## Files

- `lib/modules/manager/npm/post-update/pnpm-maturity.ts` — pure helpers
- `lib/modules/manager/npm/post-update/pnpm-maturity.spec.ts` — unit tests
- `lib/modules/manager/npm/post-update/pnpm.ts` — retry loop
- `lib/modules/manager/npm/post-update/pnpm.spec.ts` — integration-style mocks
- `lib/modules/manager/npm/post-update/types.ts` — `maturityFallback?`
- `lib/modules/manager/npm/post-update/index.ts` — artifact notice

## Verify

```bash
pnpm exec vitest run \
  lib/modules/manager/npm/post-update/pnpm-maturity.spec.ts \
  lib/modules/manager/npm/post-update/pnpm.spec.ts
```

## Open upstream PR

Target: https://github.com/renovatebot/renovate

Related issues: #40475, #42145, #39999, #39168

## Using from xAI before merge

Build/publish this branch and pin in `.github/workflows/renovate.yaml`:

```yaml
run: npx --yes github:OWNER/renovate#feat/pnpm-lockfile-maturity-retry
```

(or a git+https dependency / local `file:` path in a private fork). Prefer waiting for upstream release once merged.
