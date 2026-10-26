Extracts the `[compat]` entries of Julia `Project.toml` and `JuliaProject.toml` files.
Each entry is looked up with the [`julia-general-metadata`](../../datasource/julia-general-metadata/readme.md) datasource and [`julia`](../../versioning/julia/readme.md) versioning.

The `julia` entry constrains the Julia version itself, not a registered package, so the manager skips it.

The manager updates `Project.toml` only, not `Manifest.toml`.
