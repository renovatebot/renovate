This datasource returns releases for Julia packages from registries hosted
through [`PkgServer`](https://github.com/JuliaPackaging/PkgServer.jl/)s, e.g.
[the General registry](https://github.com/JuliaRegistries/General/) hosted
through [https://pkg.julialang.org](https://pkg.julialang.org) (which is the
default registry used by this datasource).

Custom registries are supported by specifying the full URL of the registry,
i.e. `https://<pkg-server>/registry/<uuid>`. Optionally a "state", which
corresponds to a Git tree SHA from the regitries' repository, may be appended
to the URL to retrieve releases for a package at a particular moment in time.
If the state is not provided it will be automatically determined by querying
the `PkgServer`.

When the same package is registered through multiple registries, the
corresponding releases will be merged.
