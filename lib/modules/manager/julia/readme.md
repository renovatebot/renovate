Extracts the `[compat]` entries of Julia `Project.toml` and `JuliaProject.toml` files, and looks each package up in the General registry with the [`julia-general-metadata`](../../datasource/julia-general-metadata/index.md) datasource and [`julia`](../../versioning/julia/index.md) versioning.

The manager skips:

- the `julia` entry, which constrains the Julia version itself. Raising its lower bound drops support for older Julia versions, which is the maintainer's decision.
- the standard libraries that ship only with Julia, such as `LinearAlgebra` and `Test`, because General has no versions for them. The list is fixed: if one of them is added to General later, the manager keeps skipping it until the list is updated.
- a package that `[sources]` takes from a git repository or a local path.

A package's UUID comes from `[deps]`, `[weakdeps]` or `[extras]`.
With the UUID, a package from another registry that has the name of a General package gets no updates.
Its lookup fails on every run, as does the lookup of a package that is not in General.
To skip such packages, disable them with `packageRules`:

```json
{
  "packageRules": [
    {
      "matchManagers": ["julia"],
      "matchDepNames": ["MyPrivatePackage"],
      "enabled": false
    }
  ]
}
```

A package's `depType` is the section that lists it, `deps`, `weakdeps` or `extras`, or for a package in `[extras]`, the target that `[targets]` lists it for, `test` or `build`.
So `matchDepTypes` targets the test dependencies in `[targets]`, and `matchFileNames` those in a `test/Project.toml`, which are `deps` of that file.
For example, to group the updates of test dependencies:

```json
{
  "packageRules": [
    {
      "matchManagers": ["julia"],
      "matchDepTypes": ["test"],
      "groupName": "test dependencies"
    },
    {
      "matchManagers": ["julia"],
      "matchFileNames": ["**/test/Project.toml"],
      "groupName": "test dependencies"
    }
  ]
}
```

The default `rangeStrategy` is `widen`, which adds a specifier for the new release, as CompatHelper does: `"0.10, 0.11"` with 0.12.1 becomes `"0.10, 0.11, 0.12"`, and `"0.12"` with 1.9.24 becomes `"0.12, 1"`.

The manager updates the project's manifests with Pkg, as Julia picks them: the file that the project's `manifest` entry names, or else each `JuliaManifest-vX.Y.toml` or `Manifest-vX.Y.toml`, and `JuliaManifest.toml` or `Manifest.toml`.
An update sets the manifest to the versions that Renovate updates to, and `lockFileMaintenance` updates all the manifest's packages.
This needs `julia` on the `PATH`, as with `binarySource=global`, in the exact version that wrote the manifest, its `julia_version`, or Julia 1.6 for a manifest without `julia_version`.
With [juliaup](https://github.com/JuliaLang/juliaup) 1.12 or later installed, Pkg runs in that version, as `julia +<version>`.
This needs the channel of that exact version, such as `1.10.12`, even if a `1.10` channel has it: add it with `juliaup add 1.10.12`, or set `juliaup config autoinstallchannels true` to let juliaup add it, or install it first.
`JULIAUP_DEPOT_PATH`, `JULIAUP_SERVER` and `JULIAUP_NIGHTLY_SERVER` are passed on to juliaup.
juliaup has no channel for a manifest written by a nightly build, with a `julia_version` such as `1.14.0-DEV`, so its update fails.

Pkg neither builds the packages, which runs their `deps/build.jl`, nor downloads their artifacts, unless the repository may run package scripts: with `allowScripts=true` and `ignoreScripts=false`, Pkg does both.

To see what Pkg does, set `JULIA_DEBUG` to `Pkg` with [`env`](../../../configuration-options.md#env), which needs `JULIA_DEBUG` in [`allowedEnv`](../../../self-hosted-configuration.md#allowedenv), or with [`customEnvVariables`](../../../self-hosted-configuration.md#customenvvariables).
