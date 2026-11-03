This datasource returns release information for [Julia](https://julialang.org/) packages in [package registries](https://pkgdocs.julialang.org/v1/registries/): the General registry by default, and any other registry, public or private, by the URL of its git repository.

The registries may be:

- General, as `General`, its UUID `23338594-aafe-5451-b93e-139f81909106` or its URL `https://github.com/JuliaRegistries/General`, as in Pkg. Packages in General are looked up via the [`julia-general-metadata`](../julia-general-metadata/index.md) datasource, without a clone. GeneralMetadata.jl is refreshed daily, so a new release can show up to a day after it is registered.
- A git URL: `https://`, `http://`, `ssh://` or `git@host:path`, such as that of a private registry managed with [`LocalRegistry.jl`](https://github.com/GunnarFarneback/LocalRegistry.jl). The registry is cloned with its full history on the Renovate host, at that host's cost in disk space and time, and the datasource reads its `Registry.toml` and the package's `Versions.toml` and `Package.toml`. Another URL of General, such as an SSH URL, is cloned like this too.

The registries are tried in the listed order, and the first registry that has the package is used.
The [`julia`](../../manager/julia/index.md) manager's readme shows how to configure them.

The package name is the case-sensitive package name followed by `=` and its UUID, as in Pkg's REPL: `Example=7876af07-990d-54b4-ab0e-23690620f79a`.
Only the package with that name and UUID matches.
The UUID can be left out, as in `Example`, but a name is unique only within a registry: the first listed registry with a package of that name is used.
The `julia` manager takes the UUID from the project file, so it leaves it out only when the project file does not give it.

In a cloned registry, a version's release timestamp is the commit time of the commit that added it to `Versions.toml`, as GeneralMetadata.jl does for General.
Yanked versions are marked as deprecated.

Credentials for a registry with an `https://` or `http://` URL are taken from host rules for its URL, with `hostType` `julia`.
An SSH URL is cloned with the SSH configuration of the Renovate host.
