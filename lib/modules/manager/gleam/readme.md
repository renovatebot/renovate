Updates `gleam.toml` and/or `manifest.toml` with latest and greatest dependencies.

The following `depTypes` are currently supported by the `gleam` manager:

- `dependencies`
- `dev-dependencies`

The `gleam` manager extracts dependencies for the `hex` datasource and uses Renovate's implementation of Hex SemVer to evaluate `gleam.toml` updates.
The `gleam` manager, however, uses `gleam` itself to keep `manifest.toml` up-to-date.

<!-- prettier-ignore -->
!!! note
    To ensure that all your dependencies, including those with in-range updates, are kept up-to-date, we strongly recommend enabling [`lockFileMaintenance`](../../../configuration-options.md#lockfilemaintenance) in your Renovate configuration.
    This feature will periodically refresh your `manifest.toml`, ensuring all dependencies are updated to their latest allowed versions.

Renovate's `"auto"` strategy defaults to `"widen"` and works like this for `gleam`:

1. If an existing range is a complex range (contains multiple range specifications), Renovate widens it to include the new version.
   - Example: `>= 0.14.0 and < 0.15.0` becomes `>= 0.14.0 and < 0.16.1` for a new `0.16.0` version.
1. For simple ranges, if the update is outside the existing range, Renovate widens the range to include the new version.
   - Example: `<= 0.38.0` becomes `<= 0.39.0` for a new `0.39.0` version.
1. For exact version constraints, Renovate replaces the version with the new one.
   - Example: `== 0.12.0` becomes `== 0.13.0` for a new `0.13.0` version.

If Renovate updates `gleam.toml`, then the command `gleam deps update` is used to ensure `manifest.toml` remains up-to-date as well.

<!-- prettier-ignore -->
!!! note
    For applications, it is generally [recommended to pin dependencies](../../../dependency-pinning.md), and `gleam` projects are no exception.
    To pin your dependencies in apps, use the `"pin"` strategy.
    However, for libraries, it's typically better to use version ranges along with the `"widen"` strategy to allow greater compatibility.
