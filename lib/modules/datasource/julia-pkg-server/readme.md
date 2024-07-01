This datasource returns releases for Julia packages from registries served through a Julia package server.

By default, this datasource fetches from [the `General` registry](https://github.com/JuliaRegistries/General/) through the `https://pkg.julialang.org` package server.

You can control which registries Renovate fetches from by setting the full URL of the registry.
The syntax pattern is: `https://<pkg-server>/registry/<uuid>`.
For example: `https://pkg.julialang.org/registry/23338594-aafe-5451-b93e-139f81909106` leads to the `General` registry.

If you want to fetch releases for a package from a _specific moment in time_, you can add a "state" to the end of the URL above.
This "state" must match a Git tree SHA-1 hash for the root of the registries' repository.
For example: `https://pkg.julialang.org/registry/23338594-aafe-5451-b93e-139f81909106/9b23351a11503de3096effc1f7feda386144c78b`.
If you do not set a "state", Renovate will determine it by querying the package server.

If Renovate finds the _same_ package in _multiple registries_, Renovate merges the corresponding releases.
