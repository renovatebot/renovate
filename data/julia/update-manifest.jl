# Updates the manifest at `ARGS[1]`, relative to the project, to the versions
# in the rest of `ARGS`, given as `Name@version`, or, without any, updates all
# packages.
#
# Julia picks the manifest by its own version, so the script checks that it
# picked `ARGS[1]`. A Julia other than the one that wrote the manifest would
# rewrite its `julia_version` and standard library entries, and Julia 1.7
# would rewrite a manifest without `julia_version` in its newer format, so the
# script refuses to run then.

import Pkg, TOML

env = Pkg.Types.EnvCache()
env.manifest_file == abspath(ARGS[1]) ||
    error("Julia $VERSION uses $(env.manifest_file), not $(ARGS[1])")

# As Pkg writes it: without the build, and with the first prerelease part only.
prerelease = isempty(VERSION.prerelease) ? () : (VERSION.prerelease[1],)
running = VersionNumber(VERSION.major, VERSION.minor, VERSION.patch, prerelease)
manifest_version = get(TOML.parsefile(env.manifest_file), "julia_version", nothing)
if manifest_version !== nothing
    VersionNumber(manifest_version) == running ||
        error("Julia $manifest_version wrote $(ARGS[1]), but this is Julia $running")
elseif VERSION >= v"1.7"
    error("Julia 1.6 or older wrote $(ARGS[1]), but this is Julia $running")
end

deps = get(TOML.parsefile(env.project_file), "deps", Dict{String,Any}())
specs = [
    Pkg.PackageSpec(name = String(name), version = VersionNumber(version))
    for (name, version) in (split(arg, '@'; limit = 2) for arg in ARGS[2:end])
    if haskey(deps, name)
]
if length(ARGS) == 1
    Pkg.update()
elseif !isempty(specs)
    Pkg.add(specs)
end
