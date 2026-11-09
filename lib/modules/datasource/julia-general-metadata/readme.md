This datasource returns release information for [Julia](https://julialang.org/) packages registered in the public [General registry](https://github.com/JuliaRegistries/General), via the [`GeneralMetadata.jl`](https://github.com/JuliaRegistries/GeneralMetadata.jl) JSON API at `https://juliaregistries.github.io/GeneralMetadata.jl/api/{Package}/versions.json`.

Because the `GeneralMetadata.jl` API only offers information on packages registered in the General registry, this datasource does not support custom registry URLs.
Private or alternative Julia registries (e.g. those managed via [`LocalRegistry.jl`](https://github.com/GunnarFarneback/LocalRegistry.jl)) need a different datasource.

The package name is the case-sensitive Julia package name, e.g. `Example`, optionally followed by `=` and its UUID, as in Pkg's REPL: `Example=7876af07-990d-54b4-ab0e-23690620f79a`.
A name is unique only within a registry, so with the UUID the datasource returns no releases unless the General package of that name has that UUID.
