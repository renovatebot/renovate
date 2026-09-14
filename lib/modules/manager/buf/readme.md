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

### Updating `buf.lock`

Because both the resolved commit and its content digest live in `buf.lock` (not `buf.yaml`), updates are applied by regenerating the lock file with `buf dep update` rather than by editing text in place.
This requires the [`buf`](https://buf.build/docs/cli/) binary; Renovate can install it automatically when `binarySource` is `install` or `docker`.

To authenticate against a private or rate-limited registry, add a [`hostRules`](../../../../usage/configuration-options.md#hostrules) entry with `hostType: buf-module` and a `token`.
Renovate passes it to the CLI as `BUF_TOKEN`.
