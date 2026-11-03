This datasource returns release information for [Julia](https://julialang.org/) packages registered in the public [General registry](https://github.com/JuliaRegistries/General), via the [`GeneralMetadata.jl`](https://github.com/JuliaRegistries/GeneralMetadata.jl) JSON API at `https://juliaregistries.github.io/GeneralMetadata.jl/api/{Package}/versions.json`.

Because the `GeneralMetadata.jl` API only offers information on packages registered in the General registry, this datasource does not support custom registry URLs.
For packages in private or alternative Julia registries (e.g. those managed via [`LocalRegistry.jl`](https://github.com/GunnarFarneback/LocalRegistry.jl)), use the [`julia`](../julia/index.md) datasource, which looks up packages in General via this datasource.

The package name is the case-sensitive Julia package name followed by `=` and its UUID, as in Pkg's REPL: `Example=7876af07-990d-54b4-ab0e-23690620f79a`.
The datasource returns no releases unless the General package of that name has that UUID.
The UUID can be left out, as in `Example`, but a name is unique only within a registry, so the General package of that name can be another package than the one meant.
