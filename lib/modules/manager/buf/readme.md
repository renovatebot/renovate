This manager handles two [buf](https://buf.build) config files.

It is enabled by default, and activates automatically when a repository contains a `buf.lock` or a `buf.gen.yaml` file (including language-specific templates such as `buf.gen.go.yaml`).
A `buf.yaml` on its own does not activate the manager; it is only read as a sibling of `buf.lock` to tell direct dependencies from transitive ones.
To turn the manager off, set `"buf": { "enabled": false }`, or omit `buf` from [`enabledManagers`](../../../configuration-options.md#enabledmanagers) if you use that allowlist.

### `buf.gen.yaml` — remote code-generation plugins

It extracts remote plugin references so Renovate can update them via the [`buf-plugin` datasource](../../datasource/buf-plugin/index.md), for both config versions:

- `v1`: `plugins[].plugin` values that look like `buf.build/<owner>/<name>:<version>`
- `v2`: `plugins[].remote` values in the same format

Only remote/curated plugin references are managed. Local plugins (`local:`, `protoc_builtin:`, or a bare `plugin:` name with no host) are ignored.

Plugin entries without a pinned version (`buf.build/owner/name` with no `:version`) are skipped, since there is no current version for Renovate to bump from.

### `buf.lock` — module dependencies

It reads the module dependencies pinned in `buf.lock` (both `v1`, which spells each module as `remote`/`owner`/`repository`, and `v2`, which uses a single `name`) and looks them up via the [`buf-module` datasource](../../datasource/buf-module/index.md).
Each dependency's resolved `commit` becomes its `currentDigest`, since BSR modules have no semantic version — a bump repoints the module to a newer commit.

`buf.lock` records the full transitive closure, but only the **direct** dependencies (those declared in the sibling `buf.yaml`) are updated.
Transitive entries are skipped, because `buf dep update` re-resolves them from the direct deps — updating one directly would just be overwritten on the next run.
If no sibling `buf.yaml` is found, every entry is treated as updatable.

When a direct dependency pins a **label** or branch in `buf.yaml` (e.g. `buf.build/acme/weather:staging`), that reference is tracked so digests follow it rather than the default `main` label.
A **version-like** reference (e.g. `:v1.2.3`) is skipped instead, since BSR exposes opaque commits rather than tags and cannot resolve one.
A **commit** reference (e.g. `:ba48c1a6…`) can never advance on its own — resolving a commit just returns that same commit — so it is treated like an unpinned dependency and tracked against `main`, letting the pinned commit move forward.

#### How updates are applied

A bump first swaps the `commit` in `buf.lock`, then Renovate runs `buf dep update` to regenerate the file — recomputing the accompanying `b5:` content digest (and any transitive entries) that a plain text edit cannot.
When a dependency is commit-pinned in `buf.yaml`, Renovate also advances that pin to the new commit **before** running `buf dep update`; otherwise `buf dep update` would re-resolve the old pin and revert the bump.
This requires the [`buf`](https://buf.build/docs/cli/) binary; Renovate can install it automatically when `binarySource` is `install` or `docker`.

Because `buf dep update` refreshes the whole lock file, this manager also supports [`lockFileMaintenance`](../../../configuration-options.md#lockfilemaintenance).

Each dependency's registry host is taken from its `buf.lock` entry, so self-hosted BSR instances (any host other than `buf.build`) are looked up and authenticated against their own domain.
To authenticate against a private or rate-limited registry, add a [`hostRules`](../../../configuration-options.md#hostrules) entry with `hostType: buf-module` and a `token`, matching the registry's host.
Renovate passes these to the CLI as `BUF_TOKEN`, joining multiple registries into the `token@host,token@host` form buf expects.

### Grouping and scoping updates

The manager spans two datasources, and its two kinds of dependency update differently — worth knowing before you write `packageRules`.

**BSR modules always update as digests.**
Because modules have no semantic version, every module update is [`updateType: "digest"`](../../../configuration-options.md#packagerulesmatchupdatetypes) — never `major`, `minor`, or `patch`.
A rule such as `matchUpdateTypes: ["minor", "patch"]` therefore silently never matches a BSR module.
Codegen plugins (from `buf.gen.yaml`) _are_ versioned, so they produce normal `major`/`minor`/`patch` updates.

**Two datasources, two axes.**
[`matchManagers: ["buf"]`](../../../configuration-options.md#packagerulesmatchmanagers) targets everything this manager produces — both modules and plugins.
To handle them separately, match the [datasource](../../../configuration-options.md#packagerulesmatchdatasources) instead: `buf-module` for BSR modules, `buf-plugin` for codegen plugins.

Group every buf dependency into a single PR:

```json
{
  "packageRules": [
    {
      "matchManagers": ["buf"],
      "groupName": "buf dependencies"
    }
  ]
}
```

Group modules and plugins separately — often what you want, since module digest churn is noisier than plugin version bumps:

```json
{
  "packageRules": [
    {
      "matchDatasources": ["buf-module"],
      "groupName": "BSR modules"
    },
    {
      "matchDatasources": ["buf-plugin"],
      "groupName": "buf codegen plugins"
    }
  ]
}
```
