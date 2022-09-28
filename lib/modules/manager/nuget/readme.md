Use [`packageRules`](https://docs.renovatebot.com/configuration-options/#packagerules) to control the behavior of the NuGet package manager.

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
