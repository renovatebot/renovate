Renovate can update the [mise](https://mise.jdx.dev/configuration.html#mise-toml) `mise.toml` file.

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

Renovate uses [mise registry](https://mise.jdx.dev/registry.html) to understand tools short names.

Support for new tool short names needs to be _manually_ added to Renovate's logic.

#### Adding new tool support

There are 2 ways to integrate versioning for a new tool:

- Renovate's `mise` manager: ensure upstream `mise` supports the tool, then add support to the `mise` manager in Renovate
- Renovate's `asdf` manager: improve the `asdf` manager in Renovate, which automatically extends support to `mise`

If `mise` adds support for more tools via its own [core tools](https://mise.jdx.dev/core-tools.html), you can create a PR to extend Renovate's `mise` manager to add support for the new core tools.

If you want to add support for other tools' short names to `mise`, you can create a PR to extend Renovate's `asdf` manager, which indirectly helps Renovate's `mise` manager as well.
Even if the tool does not use the `asdf` backend in the registry, the short names added to the `asdf` manager will still be used in the `mise` manager.

### Backends support

Renovate's `mise` manager supports the following [backends](https://mise.jdx.dev/dev-tools/backends/):

- [`core`](https://mise.jdx.dev/core-tools.html)
- [`asdf`](https://mise.jdx.dev/dev-tools/backends/asdf.html)
- [`aqua`](https://mise.jdx.dev/dev-tools/backends/aqua.html)
- [`cargo`](https://mise.jdx.dev/dev-tools/backends/cargo.html)
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
        "depNames": ["aqua:biomejs/biome"],
        "extractVersion": "cli/(?<version>.+)"
      }
    ]
  }
  ```

- Some of `ubi` backend tools with [`tag_regex`](https://mise.jdx.dev/dev-tools/backends/ubi.html#ubi-uses-weird-versions) option.
  The `tag_regex` option is used as `extractVersion`, but the regex engines are not the same between mise and Renovate.
  If the version is not updated or updated incorrectly, override `extractVersion` manually in the Renovate config.

### Supported default registry tool short names

Renovate's `mise` manager can only version these tool short names:

<!-- Autogenerate in https://github.com/renovatebot/renovate -->
<!-- Autogenerate end -->
