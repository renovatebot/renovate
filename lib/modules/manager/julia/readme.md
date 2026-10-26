Extracts the `[compat]` entries of Julia `Project.toml` and `JuliaProject.toml` files.
Each entry is looked up with the [`julia-general-metadata`](../../datasource/julia-general-metadata/readme.md) datasource and [`julia`](../../versioning/julia/readme.md) versioning.

The `julia` entry constrains the Julia version itself, not a registered package, so the manager skips it.

The default `rangeStrategy` is `widen`, which adds a specifier for the new release, as CompatHelper and dependabot do: `"0.10, 0.11"` with 0.12.1 becomes `"0.10, 0.11, 0.12"`.

The manager updates `Project.toml` only, not `Manifest.toml`.
