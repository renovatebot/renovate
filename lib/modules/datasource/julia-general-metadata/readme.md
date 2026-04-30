This datasource returns release information for [Julia](https://julialang.org/) packages registered in the [General registry](https://github.com/JuliaRegistries/General), via the [`GeneralMetadata.jl`](https://github.com/JuliaRegistries/GeneralMetadata.jl) JSON API.

`GeneralMetadata.jl` is the precomputed metadata service used by other tools (e.g. Dependabot). The datasource queries `https://juliaregistries.github.io/GeneralMetadata.jl/api/{Package}/versions.json`. Because it only covers the public General registry, this datasource does not support custom registry URLs. Private or alternative Julia registries (e.g. those managed via [`LocalRegistry.jl`](https://github.com/GunnarFarneback/LocalRegistry.jl)) need a different datasource.

The package name is the case-sensitive Julia package name, e.g. `Example`.
