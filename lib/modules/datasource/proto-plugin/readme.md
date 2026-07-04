This datasource resolves tools installed through a [proto](https://moonrepo.dev/proto) [TOML plugin](https://moonrepo.dev/docs/proto/non-wasm-plugin).

The `packageName` is the plugin locator from a `.prototools` file (`[plugins]` or `[plugins.tools]`): either an `http(s)://` URL, which is fetched, or a repository-relative path from a `file://` locator, which is read locally.
Renovate reads the plugin definition, takes its `[resolve] git-url` (falling back to `[install] download-url`) to find the upstream repository, and looks up versions from that repository's git tags on GitHub or GitLab.

It is used automatically by the `proto` manager; you should not need to configure it directly.
