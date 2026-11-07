Extracts the `[compat]` entries of Julia `Project.toml` and `JuliaProject.toml` files.
Each entry is looked up with the [`julia`](../../datasource/julia/index.md) datasource and [`julia`](../../versioning/julia/index.md) versioning, in the General registry by default.

To look packages up in other registries too, list them in `registryUrls`: General by name, as in Pkg, and the others by git URL.
The registries are tried in the listed order:

```json
{
  "julia": {
    "registryUrls": ["General", "https://github.com/HolyLab/HolyLabRegistry"]
  }
}
```

With `packageRules`, some packages or some project files can have other registries:

```json
{
  "packageRules": [
    {
      "matchManagers": ["julia"],
      "matchDepNames": ["CachedCalls"],
      "registryUrls": ["https://github.com/HolyLab/HolyLabRegistry"]
    },
    {
      "matchManagers": ["julia"],
      "matchFileNames": ["tools/**"],
      "registryUrls": ["General"]
    }
  ]
}
```

The manager skips:

- the `julia` entry, which constrains the Julia version itself. Raising its lower bound drops support for older Julia versions, which is the maintainer's decision.
- the standard libraries that ship only with Julia, such as `LinearAlgebra` and `Test`, because General has no versions for them. The list is fixed: if one of them is added to General later, the manager keeps skipping it until the list is updated.
- a package that `[sources]` takes from a git repository or a local path.

A package's UUID comes from `[deps]`, `[weakdeps]` or `[extras]`, and only the package with that name and UUID matches.
A package from a registry that is not listed then gets no updates, even if General has a package of that name.
Its lookup fails on every run, as does the lookup of a package that no listed registry has.
List their registry in `registryUrls`, or skip them by disabling them with `packageRules`:

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
