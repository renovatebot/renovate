Renovate can update the [mise](https://mise.jdx.dev/configuration.html#mise-toml) `.mise.toml` file.

Renovate's `mise` manager can version these tools:

<!-- Autogenerate in https://github.com/renovatebot/renovate -->
<!-- Autogenerate end -->

<!-- prettier-ignore -->
!!! warning
    Only the _first_ version entry for each supported tool is managed!
    This is due to `.mise.toml` supporting fallback versions.

To understand the versioning, Renovate re-uses:

- [mise's plugins](https://github.com/jdx/mise/tree/main/src/plugins/core)
- and [asdf's plugins](https://mise.jdx.dev/registry.html)

This also means that support for a new tool's versioning must be added one-by-one.
