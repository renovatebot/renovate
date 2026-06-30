Use [`packageRules`](../../../configuration-options.md#packagerules) to control the behavior of the NuGet package manager.

The NuGet package manager supports these SDK-style files and formats:

- `.csproj`
- `.fsproj`
- `.vbproj`
- `.props`
- `.targets`
- `global.json`
- `dotnet-tools.json`

.NET Core projects are supported by default.

For Renovate to work with .NET Framework projects, you need to update these files so they match the new SDK-style format:

- `.csproj`
- `.fsproj`
- `.vbproj`
- `.props`
- `.targets`

You can also extract from the single code file projects (since `.NET 10`).
But, you need to add those files manually to the `managerFilePatterns` as they are not supported by default.

### Disabling updates for pinned versions

In NuGet, when you use versions like `Version="1.2.3"` then it means "1.2.3 or greater" (an open-ended minimum, with no upper bound).
When you use versions like `Version="[1.2.3]"` then it means "exactly 1.2.3".

If you would like Renovate to disable updating of exact versions (warning: you might end up years out of date and not realize it) then here is an example configuration to achieve that:

```json
{
  "packageRules": [
    {
      "description": "Skip pinned versions",
      "matchManagers": ["nuget"],
      "matchCurrentValue": "/^\\[[^,]+\\]$/",
      "enabled": false
    }
  ]
}
```

### Getting updates for non-pinned (bare) versions

Per [NuGet's versioning rules](https://learn.microsoft.com/en-us/nuget/concepts/package-versioning?tabs=semver20sort#version-ranges), a bare version such as `Version="1.2.3"` is an _open-ended minimum_ (`1.2.3` or greater) — so it is NuGet, not Renovate, that treats this as a range rather than a single version.
The default `rangeStrategy` of `auto` resolves to `replace` for NuGet, and `replace` cannot produce an update for an open-ended minimum: every newer release already satisfies "1.2.3 or greater", so there is nothing to replace.
The result is that Renovate detects no updates for these dependencies and closes any existing update PRs.

To keep receiving updates for bare versions, set `rangeStrategy` to `bump`.
With `bump`, Renovate raises the minimum to the newest release (for example `1.2.3` to `1.5.0`):

```json
{
  "packageRules": [
    {
      "description": "Bump bare NuGet versions to the latest release",
      "matchManagers": ["nuget"],
      "rangeStrategy": "bump"
    }
  ]
}
```

!!! note
  This is a change in behavior.
  Earlier versions of Renovate anchored the "current version" directly to the value in your project file, so bare versions received updates under any `rangeStrategy`.
  Since Renovate `43.208.2`, Renovate no longer treats a range (including a bare NuGet version) as the current version, so the `rangeStrategy` now decides the outcome: use `bump` to restore the previous update behavior.

### Workload restore

Sometimes you need to run `dotnet workload restore` to ensure that all required workloads are installed before restoring the project.
You can enable this behavior by adding `dotnetWorkloadRestore` to the `postUpdateOptions` in your Renovate configuration.

```json
{
  "postUpdateOptions": ["dotnetWorkloadRestore"]
}
```
