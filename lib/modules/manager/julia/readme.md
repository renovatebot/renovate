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

The default `rangeStrategy` is `widen`, which adds a specifier for the new release, as CompatHelper and dependabot do: `"0.10, 0.11"` with 0.12.1 becomes `"0.10, 0.11, 0.12"`.

The manager updates `Project.toml` only, not `Manifest.toml`.

The locked versions come from the manifest that the project's `manifest` entry names, or else from `JuliaManifest.toml` or `Manifest.toml`, or else from the versioned manifest of the newest Julia, such as `Manifest-v1.12.toml`.
