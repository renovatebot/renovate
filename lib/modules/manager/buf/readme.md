This manager handles two [buf](https://buf.build) config files.

## `buf.gen.yaml` — remote code-generation plugins

It extracts remote plugin references so Renovate can update them via the [`buf-plugin` datasource](../../datasource/buf-plugin/index.md), for both config versions:

- `v1`: `plugins[].plugin` values that look like `buf.build/<owner>/<name>:<version>`
- `v2`: `plugins[].remote` values in the same format

Only remote/curated plugin references are managed. Local plugins (`local:`, `protoc_builtin:`, or a bare `plugin:` name with no host) are ignored.

Plugin entries without a pinned version (`buf.build/owner/name` with no `:version`) are skipped, since there is no current version for Renovate to bump from.

## `buf.yaml` — module dependencies

It extracts the module dependencies listed under `deps[]` (both `v1` and `v2`) and looks them up via the [`buf-module` datasource](../../datasource/buf-module/index.md).
Each dependency is pinned to the resolved commit recorded for it in the sibling `buf.lock` file, which becomes the dependency's `currentDigest`.
Dependencies with no matching `buf.lock` entry are surfaced but skipped, since there is no resolved commit to bump from.
