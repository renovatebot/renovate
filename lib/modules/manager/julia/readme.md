Extracts dependencies from [Julia](https://julialang.org/) `Project.toml` and `JuliaProject.toml` files. Each entry under the `[compat]` section is emitted as a `PackageDependency` with the [`julia-general-metadata`](../../datasource/julia-general-metadata/readme.md) datasource and [`julia`](../../versioning/julia/readme.md) versioning.

The `julia = "..."` entry under `[compat]` constrains the language runtime itself rather than a package in the [General registry](https://github.com/JuliaRegistries/General); this manager skips it. A future Julia-runtime datasource (analogous to `python-version`/`node-version`) can pick it up.

`Manifest.toml` lock files are intentionally **not** updated by this manager: per the [Julia Pkg docs](https://pkgdocs.julialang.org/v1/toml-files/#Manifest.toml), the manifest is regenerated from the project + registry on `Pkg.instantiate()` / `Pkg.up()`, so leaving it in place is harmless and avoids needing to spawn Julia to compute the new manifest.
