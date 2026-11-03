Extracts the `[compat]` entries of Julia `Project.toml` and `JuliaProject.toml` files.
Each entry is looked up with the [`julia-general-metadata`](../../datasource/julia-general-metadata/index.md) datasource and [`julia`](../../versioning/julia/index.md) versioning.
When `[deps]`, `[weakdeps]` or `[extras]` gives the package's UUID, the lookup checks it: a package from another registry that has the name of a General package gets no updates.

The `julia` entry constrains the Julia version itself, not a registered package, so the manager skips it.
Raising its lower bound drops support for older Julia versions, which is the maintainer's decision.

It also skips the standard libraries that ship only with Julia, such as `LinearAlgebra` and `Test`, because the General registry has no versions for them.
The list is fixed: if General registers one of them later, the manager keeps skipping it until the list is updated.

The default `rangeStrategy` is `widen`, which adds a specifier for the new release, as CompatHelper and dependabot do: `"0.10, 0.11"` with 0.12.1 becomes `"0.10, 0.11, 0.12"`.

The manager updates `Project.toml` only, not `Manifest.toml`.
