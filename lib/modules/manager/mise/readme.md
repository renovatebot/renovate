Renovate can update [mise configuration files](https://mise.jdx.dev/configuration.html#mise-toml).

### Supported configuration files

Renovate supports all standard mise configuration file patterns:

- `mise.toml`, `.mise.toml`
- `mise/config.toml`, `.mise/config.toml`
- `.config/mise.toml`, `.config/mise/config.toml`, `.config/mise/mise.toml`
- `.rtx.toml` (legacy)
- Environment-specific variants (e.g., `mise.production.toml`, `.mise.dev.toml`)
- Local variants (e.g., `mise.local.toml`, `.mise.local.toml`)

### Lock file support

Renovate supports mise lock files (`mise.lock`).
When a lock file is present:

- Dependencies will have their `lockedVersion` extracted from the lock file
- Renovate can update lock files when dependencies change
- Lock file maintenance is supported via the `lockFileMaintenance` option

Renovate recognizes environment-specific lock files:

- `mise.lock` - default lock file
- `mise.local.lock` - local configuration lock file, typically ignored alongside `mise.local.toml`
- `mise.{env}.lock` - environment-specific lock files (e.g., `mise.production.lock`)
- `mise.{env}.local.lock` - environment-specific local lock files, typically ignored alongside `mise.{env}.local.toml`

For more information about mise lock files, see the [mise lock file documentation](https://mise.jdx.dev/dev-tools/mise-lock.html).

### Renovate only updates primary versions

Renovate's `mise` manager is designed to automatically update the _first_ (primary) version listed for each tool in the `mise.toml` file.

Secondary or fallback versions require manual updates.

#### Example

Given a `mise.toml` entry like:

```toml
[tools]
erlang = ["23.3", "22.0"]
```

Renovate will update `"23.3"` (the primary version) but will not touch `"22.0"` (the fallback version).

#### Why can Renovate only update primary versions?

To maintain consistency and reliability, Renovate opts to only manage the _first_ listed version.

- Fallback versions can often be older versions of a tool that are known to work and are there as a backup.

This follows the same workflow that Renovate's `asdf` manager uses.

### Short names support

Renovate uses the [mise registry](https://mise.jdx.dev/registry.html) to resolve tool short names to their appropriate datasource.

Where possible, Renovate will automagically support tools from the mise registry (via `mise registry --json`).

This means that any tool in the mise registry that has a supported backend (e.g. `aqua`, `github`, `cargo`) should be automatically supported by Renovate.

#### Adding new tool support

If a tool you need is not yet in the mise registry, add it upstream to [mise](https://mise.jdx.dev/registry.html).
Once Renovate syncs its registry data, the tool will be supported automatically, as long as it is in a backend that Renovate supports.

For tools that need a custom datasource mapping (e.g. core tools like `node`, `python`), you can create a PR to extend Renovate's `mise` manager directly.

If you want to add support for other tools' short names to `mise`, you can create a PR to extend Renovate's `asdf` manager, which indirectly helps Renovate's `mise` manager as well.
Even if the tool does not use the `asdf` backend in the registry, the short names added to the `asdf` manager will still be used in the `mise` manager.

This may no longer be necessary now we automagically add support via the tools that the mise registry advertises.

### Backends support

Renovate's `mise` manager supports the following [backends](https://mise.jdx.dev/dev-tools/backends/):

- [`core`](https://mise.jdx.dev/core-tools.html)
- [`asdf`](https://mise.jdx.dev/dev-tools/backends/asdf.html)
- [`aqua`](https://mise.jdx.dev/dev-tools/backends/aqua.html)
- [`cargo`](https://mise.jdx.dev/dev-tools/backends/cargo.html)
- [`gem`](https://mise.jdx.dev/dev-tools/backends/gem.html)
- [`github`](https://mise.jdx.dev/dev-tools/backends/github.html)
- [`go`](https://mise.jdx.dev/dev-tools/backends/go.html)
- [`npm`](https://mise.jdx.dev/dev-tools/backends/npm.html)
- [`pipx`](https://mise.jdx.dev/dev-tools/backends/pipx.html)
- [`spm`](https://mise.jdx.dev/dev-tools/backends/spm.html)
- [`ubi`](https://mise.jdx.dev/dev-tools/backends/ubi.html)
- [`vfox`](https://mise.jdx.dev/dev-tools/backends/vfox.html)

#### Limitations

Renovate's `mise` manager does not support the following tool syntax:

- `asdf` and `vfox` plugins
  e.g. `asdf:mise-plugins/asdf-yarn` or `vfox:version-fox/vfox-elixir`
  Short names with backends like `asdf:yarn` or `vfox:elixir` are supported if the short names (`yarn`, `elixir`) are supported.

- `aqua` packages with `http` [package type](https://aquaproj.github.io/docs/reference/registry-config/#package-types).
  However if the short name using `aqua` backend is supported by Renovate, it will be updated.
  e.g. [`aqua:helm/helm`](https://github.com/aquaproj/aqua-registry/blob/main/pkgs/helm/helm/registry.yaml) is not supported, but `helm` or `aqua:helm` is supported.

- `aqua` packages with [`version_filter`](https://aquaproj.github.io/docs/reference/registry-config/version-prefix).
  We don't read the aqua registry itself, so we can't support this feature.
  If some packages using `version_filter` like [`aqua:biomejs/biome`](https://github.com/aquaproj/aqua-registry/blob/main/pkgs/biomejs/biome/registry.yaml) are not updated or updated incorrectly, set `extractVersion` in the Renovate config manually like below.

  ```json
  {
    "packageRules": [
      {
        "matchDepNames": ["aqua:biomejs/biome"],
        "extractVersion": "cli/(?<version>.+)"
      }
    ]
  }
  ```

- Some of `ubi` backend tools with [`tag_regex`](https://mise.jdx.dev/dev-tools/backends/ubi.html#ubi-uses-weird-versions) option.
  The `tag_regex` option is used as `extractVersion`, but the regex engines are not the same between mise and Renovate.
  If the version is not updated or updated incorrectly, override `extractVersion` manually in the Renovate config.

- Some of `github` backend tools with [`version_prefix`](https://mise.jdx.dev/dev-tools/backends/github.html) option.
  The `version_prefix` option is converted to `extractVersion` by escaping special regex characters.
  If the version is not updated or updated incorrectly, override `extractVersion` manually in the Renovate config.

- Renovate will prefer the `github:` backend over other backends, if using the tool definition from the mise registry

### Supported default registry tool short names

<!-- Autogenerate in https://github.com/renovatebot/renovate -->
<!-- Autogenerate end -->
