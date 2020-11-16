---
title: Nuget (.NET)
description: Nuget (.NET) dependencies support in Renovate
---

# Nuget

Renovate supports upgrading dependencies in `.csproj`, `.fsproj`, and `.vbproj` files.

## Version Support

Only SDK-style `.csproj`/`.fsproj`/`.vbproj`files are currently supported. By default, this includes:

- .NET Core 1.0 and above
- .NET Standard class libraries
- Any `.csproj`/`.fsproj`/`.vbproj` in the SDK-style syntax

To convert your .NET Framework `.csproj`/`.fsproj`/`.vbproj` into an SDK-style project, one can follow the [following guide](https://natemcmaster.com/blog/2017/03/09/vs2015-to-vs2017-upgrade/).

## How It Works

1.  Renovate will search each repository for any files with a `.csproj`, `.fsproj`, or `.vbproj` extension
2.  Existing dependencies will be extracted from `<PackageReference>` and `<PackageVersion>` tags
3.  Renovate will look up the latest version on [nuget.org](https://nuget.org) (or on [alternate feeds](#Alternate%20feeds)) to determine if any upgrades are available
4.  If the source package includes a GitHub URL as its source, and has either a "changelog" file or uses GitHub releases, then Release Notes for each version will be embedded in the generated PR

## Alternate feeds

Renovate by default performs all lookups on `https://api.nuget.org/v3/index.json`, but it also supports alternative NuGet feeds.
Alternative feeds can be specified either [in a `NuGet.config` file](https://docs.microsoft.com/en-us/nuget/reference/nuget-config-file#package-source-sections) within your repository (Renovate will not search outside the repository) or in Renovate configuration options:

```json
"nuget": {
  "registryUrls": [
    "https://api.nuget.org/v3/index.json",
    "http://example1.com/nuget/"
    "http://example2.com/nuget/v3/index.json"
  ]
}
```

If this example we defined 3 NuGet feeds.
Packages resolving will process feeds consequentially.
It means that if package will be resolved in second feed renovate won't look in last one.

### Protocol versions

NuGet supports two protocol versions, `v2` and `v3`, which NuGet client and server need to agree on.
Renovate as a NuGet client supports both versions and will use `v2` unless the configured feed URL ends with `index.json` (which mirrors the behavior of the official NuGet client).
If you have `v3` feed that does not match this pattern (e.g. JFrog Artifactory) you need to help Renovate by appending `#protocolVersion=3` to the registry URL:

```json
"nuget": {
  "registryUrls": [
    "http://myV3feed#protocolVersion=3"
  ]
}
```

## Authenticated feeds

Credentials for authenticated/private feeds can be provided via host rules in the configuration options (file or command line parameter).

```json
"hostRules": [
  {
    "hostType": "nuget",
    "endpoint": "http://example1.com/nuget",
    "username": "root",
    "password": "p4$$w0rd"
  }
]
```

Please note that at the moment only Basic HTTP authentication (via username and password) is supported.

## Future work

Contributions and/or feature requests are welcome to support more patterns or additional use cases.
