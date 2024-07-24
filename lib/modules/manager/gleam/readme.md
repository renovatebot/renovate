Updates `gleam.toml` and/or `manifest.toml` with latest and greatest dependencies.

The following `depTypes` are currently supported by the `gleam` manager:

- `dependencies`
- `dev-dependencies`

The `gleam` manager extracts dependencies for the `hex` datasource and uses Renovate's implementation of Hex SemVer to evaluate `gleam.toml` updates.
The `gleam` manager, however, uses `gleam` itself to keep `manifest.toml` up-to-date.

Renovate's `"auto"` strategy works like this for `gleam`:

1. If an existing range already contains with an "and" operator, like `">= 1.0.0 and < 2.0.0"`, then Renovate widens it into `">= 1.0.0 and < 2.1.0"`
1. Otherwise, if the update is outside the existing range, Renovate replaces the range. So `"<= 2.0.0"` is replaced by `"<= 2.1.0"`
1. Finally, if the update is in-range, Renovate will update `manifest.toml` with the new exact version
