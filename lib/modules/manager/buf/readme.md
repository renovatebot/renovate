This manager extracts remote plugin references from `buf.gen.yaml`, the [buf](https://buf.build) code generation config, so Renovate can update them via the [`buf-plugin` datasource](../../datasource/buf-plugin/index.md).

It supports both config versions:

- `v1`: `plugins[].plugin` values that look like `buf.build/<owner>/<name>:<version>`
- `v2`: `plugins[].remote` values in the same format

Only remote/curated plugin references are managed. Local plugins (`local:`, `protoc_builtin:`, or a bare `plugin:` name with no host) are ignored, as are `buf.yaml`/`buf.lock` module dependencies, which this manager does not (yet) support.

Plugin entries without a pinned version (`buf.build/owner/name` with no `:version`) are skipped, since there is no current version for Renovate to bump from.
