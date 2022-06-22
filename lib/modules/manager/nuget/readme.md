You can use the `nuget` configuration object to control the settings for the NuGet package manager.

The NuGet package manager supports these SDK-style files and formats:

- `.csproj`
- `.fsproj`
- `.vbproj`
- `.props`
- `.targets`

.NET Core projects are supported by default.

For Renovate to work with .NET Framework projects, you need to update these files so they match the new SDK-style format:

- `.csproj`
- `.fsproj`
- `.vbproj`
- `.props`
- `.targets`

The NuGet manager also supports `global.json` and `dotnet-tools.json` SDK files.
