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

<!--
  TODO: remove ignore
  prettier & markdownlint conflicting nested list format
  see: https://github.com/renovatebot/renovate/pull/30608
-->
<!-- prettier-ignore -->
1. If an existing range is a complex range (contains multiple range specifications), Renovate widens it to include the new version.
    - Example: `>= 0.14.0 and < 0.15.0` becomes `>= 0.14.0 and < 0.16.1` for a new `0.16.0` version.
1. For simple ranges, if the update is outside the existing range, Renovate widens the range to include the new version.
    - Example: `<= 0.38.0` becomes `<= 0.39.0` for a new `0.39.0` version.
1. For exact version constraints, Renovate replaces the version with the new one.
    - Example: `== 0.12.0` becomes `== 0.13.0` for a new `0.13.0` version.

<!-- prettier-ignore -->
!!! warning
    The `gleam` manager does not support the `"update-lockfile"` or `"in-range-only"` strategies.
    If used, the `gleam` manager will default to the `"widen"` strategy instead.
