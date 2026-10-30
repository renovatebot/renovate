Renovate can update tool versions in [proto](https://moonrepo.dev/proto) `.prototools` configuration files.

### How it works

Proto uses `.prototools` files (TOML format) to pin tool versions at the directory level.
Tool versions are declared as top-level key-value pairs:

```toml
node = "22.14.0"
bun = "1.2.2"
go = "~1.22"
proto = "0.56.0"
```

Renovate extracts these version pins and updates them using the appropriate datasource for each tool.

Non-version configuration sections (`[settings]`, `[tools]`, `[env]`, `[shell]`, `[backends]`) are ignored.

### Custom plugin tools

Tools that aren't built in are installed via a [TOML plugin](https://moonrepo.dev/docs/proto/non-wasm-plugin) declared under `[plugins]` or `[plugins.tools]`.
Renovate resolves these from the plugin's `[resolve] git-url`, which points at the upstream repository proto reads git tags from:

```toml
buf = "1.71.0"

[plugins.tools]
buf = "https://raw.githubusercontent.com/example/proto-plugins/main/buf/plugin.toml"
```

Both `file://` and `http(s)://` plugins are resolved lazily by the `proto-plugin` datasource, which reads the plugin definition when looking up versions and maps it to the `github-tags` or `gitlab-tags` datasource for its repository.
Since proto pins are bare versions while git tags are commonly `v`-prefixed, an optional leading `v` is stripped when matching.

### Supported tools

Renovate's `proto` manager supports the following built-in proto tools:

| Tool     | Datasource        | Package                |
| -------- | ----------------- | ---------------------- |
| `bun`    | `github-releases` | `oven-sh/bun`          |
| `deno`   | `github-releases` | `denoland/deno`        |
| `go`     | `github-tags`     | `golang/go`            |
| `moon`   | `github-releases` | `moonrepo/moon`        |
| `node`   | `node-version`    | `node`                 |
| `npm`    | `npm`             | `npm`                  |
| `pnpm`   | `npm`             | `pnpm`                 |
| `yarn`   | `npm`             | `@yarnpkg/cli`         |
| `python` | `github-tags`     | `python/cpython`       |
| `ruby`   | `ruby-version`    | `ruby-version`         |
| `rust`   | `rust-version`    | `rust`                 |
| `proto`  | `github-releases` | `moonrepo/proto`       |
| `gh`     | `github-releases` | `cli/cli`              |
| `poetry` | `github-releases` | `python-poetry/poetry` |
| `uv`     | `github-releases` | `astral-sh/uv`         |

### Limitations

- **WASM plugins**: Tools installed via a compiled WASM plugin (a `.wasm` locator, or a `github://` release-asset locator) carry no introspectable version source, so they are reported as `unsupported-datasource` and skipped.
  You can use Renovate's `customManagers` with regex to handle these if needed.

- **Plugin resolve options**: Only `[resolve] git-url` is read. A plugin's `version-pattern` is ignored, so tags must be plain versions with an optional leading `v`, and Renovate finds no releases for a plugin that resolves through `manifest-url`.

- **Non-GitHub/GitLab repositories**: A custom plugin whose repository is not hosted on `github.com` or `gitlab.com` has no releases found.

- **Version aliases**: Values like `latest`, `stable`, `canary`, or `nightly` are skipped as they cannot be updated via semver.

- **Version ranges**: Proto supports partial versions (`22`, `~1.20`, `^3.1`) which Renovate passes through as-is.
  The appropriate versioning strategy for each datasource handles these.

- **asdf backend syntax**: Proto supports `"asdf:tool" = "version"` syntax for tools via the asdf backend.
  This is not currently supported by the manager.
