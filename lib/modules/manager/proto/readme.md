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

Non-version sections (`[settings]`, `[plugins]`, `[tools]`, `[env]`, `[shell]`, `[backends]`) are ignored.

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
| `rust`   | `github-tags`     | `rust-lang/rust`       |
| `proto`  | `github-releases` | `moonrepo/proto`       |
| `gh`     | `github-releases` | `cli/cli`              |
| `poetry` | `github-releases` | `python-poetry/poetry` |
| `uv`     | `github-releases` | `astral-sh/uv`         |

### Limitations

- **Third-party plugins**: Tools installed via `[plugins]` URLs (custom WASM plugins) are reported as `unsupported-datasource` and skipped.
  You can use Renovate's `customManagers` with regex to handle these if needed.

- **Version aliases**: Values like `latest`, `stable`, `canary`, or `nightly` are skipped as they cannot be updated via semver.

- **Version ranges**: Proto supports partial versions (`22`, `~1.20`, `^3.1`) which Renovate passes through as-is.
  The appropriate versioning strategy for each datasource handles these.

- **asdf backend syntax**: Proto supports `"asdf:tool" = "version"` syntax for tools via the asdf backend.
  This is not currently supported by the manager.
