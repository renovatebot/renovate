Renovate can update the [mise](https://mise.jdx.dev/configuration.html#mise-toml) `.mise.toml` file.

Renovate's `mise` manager can version these tools:

<!-- Autogenerate in https://github.com/renovatebot/renovate -->
<!-- Autogenerate end -->

<!-- prettier-ignore -->
### Renovate only updates primary versions

Renovate's `mise` manager is designed to automatically update the _first_ (primary) version listed for each tool in the `mise.toml` file.

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

### Plugin/Tool support

Renovate leverages:

- [mise's plugins](https://github.com/jdx/mise/tree/main/src/plugins/core)
- [asdf's plugins](https://mise.jdx.dev/registry.html)

for understanding and managing tool versioning.

Support for new tools/plugins needs to be _manually_ added to Renovate's logic.

#### Adding new tool support

Adding support for a new tool involves either contributing to Mise Plugins or extending Renovate's asdf manager, which indirectly benefits mise management.

To integrate versioning for a new tool:

- Mise Native Support: Add the tool directly to Mise Plugins.
- Via Renovate's `asdf` Manager: Enhance the asdf manager in Renovate, which automatically extends support to mise.
