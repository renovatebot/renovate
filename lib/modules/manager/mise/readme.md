Renovate can update the [mise](https://mise.jdx.dev/configuration.html#mise-toml) `.mise.toml` file.

Renovate's `mise` manager can version these tools:

<!-- Autogenerate in https://github.com/renovatebot/renovate -->
<!-- Autogenerate end -->

<!-- prettier-ignore -->
!!! warning
    Only the _first_ version entry for each supported tool is managed by Renovate. This limitation arises from the way `.mise.toml` is designed to handle fallback versions.
    Specifically, when multiple versions are specified for a tool, `.mise.toml` allows for fallback to secondary versions if the primary version is unavailable.
    Example: 'erlang = ["23.3", "22.0"]'
    Fallback versions provide a safety net in case the primary version is not accessible - the first version provided is the primary version and should be used where possible.
    Renovate will only update the primary version - it is the users' responsibility to maintain functioning fallback versions.

To understand the versioning, Renovate re-uses:

- [mise's plugins](https://github.com/jdx/mise/tree/main/src/plugins/core)
- and [asdf's plugins](https://mise.jdx.dev/registry.html)

This also means that support for a new tool's versioning must be added one-by-one.
