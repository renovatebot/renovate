# Turns Pkg's build and artifact download steps into no-ops: Pkg has no
# option to skip them, and the manifest needs neither. A build runs the
# package's `deps/build.jl`, which is arbitrary code.
#
# The methods replaced are those of the Pkg of each Julia version from 1.6 to
# 1.13. A later Pkg has its methods replaced as they are, and if any method is
# left that this script did not define, it fails rather than run the builds.

import Pkg
using Base: UUID
using Pkg.Types: Context, EnvCache, PackageSpec

const julia_minor = VersionNumber(VERSION.major, VERSION.minor)

@static if julia_minor == v"1.6"
    Pkg.Operations.build_versions(::Context, ::Vector{UUID}; kwargs...) = nothing
    Pkg.Operations.download_artifacts(::Context, ::Vector{PackageSpec}; kwargs...) = nothing
    Pkg.Operations.download_artifacts(::Context, ::Vector{String}; kwargs...) = nothing
elseif v"1.7" <= julia_minor <= v"1.11"
    Pkg.Operations.build_versions(::Context, ::Set{UUID}; kwargs...) = nothing
    Pkg.Operations.download_artifacts(::EnvCache; kwargs...) = nothing
elseif v"1.12" <= julia_minor <= v"1.13"
    Pkg.Operations.build_versions(::Context, ::Set{UUID}; kwargs...) = nothing
    Pkg.Operations.download_artifacts(::Context; kwargs...) = nothing
    Pkg.Operations.download_artifacts(::Context, ::Any; kwargs...) = nothing
else
    for f in (Pkg.Operations.build_versions, Pkg.Operations.download_artifacts)
        for m in methods(f)
            types = Base.unwrap_unionall(m.sig).parameters[2:end]
            args = [:(::$type) for type in types]
            @eval Pkg.Operations.$(nameof(f))($(args...); kwargs...) = nothing
        end
    end
end

for f in (Pkg.Operations.build_versions, Pkg.Operations.download_artifacts)
    ms = methods(f)
    !isempty(ms) && all(m -> m.module === @__MODULE__, ms) ||
        error("Pkg.Operations.$(nameof(f)) has methods that this script did not replace")
end
