This datasource returns releases of the .NET Runtime and SDK.
It only accepts dependencies with the name `dotnet-sdk` or `dotnet-runtime`.

By default the releases index is read from `https://dotnetcli.blob.core.windows.net/dotnet/release-metadata/releases-index.json`.
Set `registryUrls` to the URL of a mirrored `releases-index.json` to read it from somewhere else.
The channel files are fetched from the URLs listed inside that index, so a mirror should point at its own copies.
