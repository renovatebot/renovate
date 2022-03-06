The `nuget` configuration object is used to control settings for the NuGet package manager.
The NuGet package manager supports a SDK-style `.csproj`/`.fsproj`/`.vbproj`/`.props`/`.targets` format, as described [here](https://natemcmaster.com/blog/2017/03/09/vs2015-to-vs2017-upgrade/).
This means that .NET Core projects are all supported but any .NET Framework projects need to be updated to the new `.csproj`/`.fsproj`/`.vbproj`/`.props`/`.targets` format in order to be detected and supported by Renovate.

The NuGet manager also supports `global.json` and `dotnet-tools.json` SDK files.
