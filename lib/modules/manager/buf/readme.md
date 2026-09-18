This manager handles two [buf](https://buf.build) config files.

## `buf.gen.yaml` — remote code-generation plugins

It extracts remote plugin references so Renovate can update them via the [`buf-plugin` datasource](../../datasource/buf-plugin/index.md), for both config versions:

- `v1`: `plugins[].plugin` values that look like `buf.build/<owner>/<name>:<version>`
- `v2`: `plugins[].remote` values in the same format

Only remote/curated plugin references are managed. Local plugins (`local:`, `protoc_builtin:`, or a bare `plugin:` name with no host) are ignored.

Plugin entries without a pinned version (`buf.build/owner/name` with no `:version`) are skipped, since there is no current version for Renovate to bump from.

## `buf.lock` — module dependencies

It reads the module dependencies pinned in `buf.lock` (both `v1`, which spells each module as `remote`/`owner`/`repository`, and `v2`, which uses a single `name`) and looks them up via the [`buf-module` datasource](../../datasource/buf-module/index.md).
Each dependency's resolved `commit` becomes its `currentDigest`, since BSR modules have no semantic version — a bump repoints the module to a newer commit.

### How updates are applied

A bump first swaps the `commit` in `buf.lock`, then Renovate runs `buf dep update` to regenerate the file — recomputing the accompanying `b5:` content digest (and any transitive entries) that a plain text edit cannot.
This requires the [`buf`](https://buf.build/docs/cli/) binary; Renovate can install it automatically when `binarySource` is `install` or `docker`.

Because `buf dep update` refreshes the whole lock file, this manager also supports [`lockFileMaintenance`](../../../configuration-options.md#lockfilemaintenance).

To authenticate against a private or rate-limited registry, add a [`hostRules`](../../../../usage/configuration-options.md#hostrules) entry with `hostType: buf-module` and a `token`.
Renovate passes it to the CLI as `BUF_TOKEN`.
