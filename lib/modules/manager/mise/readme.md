Renovate can update the [mise](https://mise.jdx.dev/configuration.html#mise-toml) `mise.toml` file.

### Renovate only updates primary versions

Renovate's `mise` manager is designed to automatically update the _first_ (primary) version listed for each tool in the `.mise.toml` file.

Secondary or fallback versions require manual updates.

#### Example

Given a `.mise.toml` entry like:

```toml
[tools]
erlang = ["23.3", "22.0"]
```

Renovate will update `"23.3"` (the primary version) but will not touch `"22.0"` (the fallback version).

#### Why can Renovate only update primary versions?

To maintain consistency and reliability, Renovate opts to only manage the _first_ listed version.

- Fallback versions can often be older versions of a tool that are known to work and are there as a backup.

This follows the same workflow that Renovate's `asdf` manager uses.

### Plugin/tool support

Renovate uses:

- [mise's core tools](https://github.com/jdx/mise/tree/main/src/plugins/core)
- [asdf's plugins](https://mise.jdx.dev/registry.html)

to understand and manage tool versioning.

Support for new tools/plugins needs to be _manually_ added to Renovate's logic.

#### Adding new tool support

There are 2 ways to integrate versioning for a new tool:

- Renovate's `mise` manager: ensure upstream `mise` supports the tool, then add support to the `mise` manager in Renovate
- Renovate's `asdf` manager: improve the `asdf` manager in Renovate, which automatically extends support to `mise`

If `mise` adds support for more tools via its own [core plugins](https://mise.jdx.dev/plugins.html#core-plugins), you can create a PR to extend Renovate's `mise` manager to add support for the new tooling.

You may be able to add support for new tooling upstream in the core plugins - create an issue and see if the community agrees whether it belongs there, or if it would be better as an `asdf-` plugin.

If you are wanting to add support for an existing `asdf-x` plugin to `mise`, you can create a PR to extend Renovate's `asdf` manager, which indirectly helps Renovate's `mise` manager as well.

### Unsupported tools

- `core`, `asdf`, and `vfox` backended tools are only supported if they are in the default registry of `mise`.

- asdf and vfox plugins are not supported unless they are in the default registry of mise.

- Non-GitHub aqua backend package types.
  mise only supports http now (2024/12/07)
  <https://aquaproj.github.io/docs/reference/registry-config/#package-types>
  // ref: <https://github.com/jdx/mise/blob/d1b9749d8f3e13ef705c1ea471d96c5935b79136/src/aqua/aqua_registry.rs#L39-L45>
  <https://github.com/search?q=repo%3Aaquaproj%2Faqua-registry+%22type%3A+http%22&type=code>

- aqua versions filter is not supported. use extractVersion manually.

- ubi tag_regex is supported but not perfectly compatible, as re2 and rust regex engines are different.

- cargo backend supports github installation but doesn't support it
  <https://mise.jdx.dev/dev-tools/backends/cargo.html#using-git>

- strips leading v from version

### Supported default registry short tool names

Renovate's `mise` manager can only version these tools in the default registry:

<!-- Autogenerate in https://github.com/renovatebot/renovate -->
<!-- Autogenerate end -->
