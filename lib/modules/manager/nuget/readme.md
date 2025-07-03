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

### Disabling updates for pinned versions

In NuGet, when you use versions like `Version="1.2.3"` then it means "1.2.3 or greater, up to v2"
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
