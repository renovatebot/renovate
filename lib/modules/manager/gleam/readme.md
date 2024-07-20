Updates `gleam.toml` and/or `manifest.toml` with latest and greatest dependencies.

The following `depTypes` are currently supported by the `gleam` manager:

- `dependencies`
- `dev-dependencies`

The `gleam` manager extracts dependencies for the `hex` datasource and uses Renovate's implementation of Hex SemVer to evaluate `gleam.toml` updates. The `gleam` manager, however, uses `gleam` itself to keep `manifest.toml` up-to-date.
