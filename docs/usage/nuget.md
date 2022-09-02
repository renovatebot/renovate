---
title: NuGet (.NET)
description: NuGet (.NET) dependencies support in Renovate
---

# NuGet

Renovate can upgrade dependencies in these files:

- `.csproj`
- `.fsproj`
- `.vbproj`

## Version Support

Renovate only works with SDK-style `.csproj`, `.fsproj` or `.vbproj` files.
By default, this includes:

- .NET Core 1.0 and above
- .NET Standard class libraries
- `.csproj`, `.fsproj` or `.vbproj` files that use the SDK-style syntax

To convert your .NET Framework `.csproj`, `.fsproj` or `.vbproj` files into an SDK-style project, follow the steps in this [guide](https://natemcmaster.com/blog/2017/03/09/vs2015-to-vs2017-upgrade/).

## How it works

1. Renovate searches in each repository for any files with a `.csproj`, `.fsproj`, or `.vbproj` extension
1. Existing dependencies are extracted from `<PackageReference>` and `<PackageVersion>` tags
1. Renovate looks up the latest version on [nuget.org](https://nuget.org) (or an alternative feed if configured) to see if any upgrades are available
1. If the source package includes a GitHub URL as its source, and has either:

   - a "changelog" file, or
   - uses GitHub releases

   then release notes for each version are embedded in the generated PR

If your project file references a `packages.config` file, no dependencies will be extracted.
Find out here how to [migrate from `packages.config` to `PackageReference`](https://docs.microsoft.com/en-us/nuget/consume-packages/migrate-packages-config-to-package-reference).

## Alternate feeds

By default Renovate performs all lookups on `https://api.nuget.org/v3/index.json`, but you can set alternative NuGet feeds.
You can set alternative feeds:

- in a [`NuGet.config` file](https://docs.microsoft.com/en-us/nuget/reference/nuget-config-file#package-source-sections) within your repository (Renovate will not search outside the repository), or
- in a Renovate configuration options file like `renovate.json`

```json
{
  "nuget": {
    "registryUrls": [
      "https://api.nuget.org/v3/index.json",
      "https://example1.com/nuget/",
      "https://example2.com/nuget/v3/index.json"
    ]
  }
}
```

In the example above we've set three NuGet feeds.
The package resolving process uses the `merge` strategy to handle the three feeds.
All feeds are checked for dependency updates, and duplicate updates are merged/joined together into a single dependency update.

If your project uses lockfiles (a `package.lock.json` exists), alternate feed settings must be defined in a `NuGet.config` only, as `registryUrls` are not passed through to the NuGet commands used.

### Protocol versions

NuGet supports two protocol versions, `v2` and `v3`.
The NuGet client and server must use the same version.

Renovate as a NuGet client supports both `v2` and `v3` protocols, and will use `v2` unless the configured feed URL ends with `index.json`.
This mirrors the behavior of the official NuGet client.

If you have a `v3` feed that doesn't end with `index.json`, like for example on the JFrog Artifactory, then you must append `#protocolVersion=3` to the registry URL:

```json
{
  "nuget": {
    "registryUrls": ["http://myV3feed#protocolVersion=3"]
  }
}
```

## Authenticated feeds

Credentials for authenticated/private feeds can be given via host rules in the configuration options (file or command line parameter).

```json
{
  "hostRules": [
    {
      "hostType": "nuget",
      "matchHost": "http://example1.com/nuget",
      "username": "root",
      "password": "p4$$w0rd"
    }
  ]
}
```

<!-- prettier-ignore -->
!!! note
    Only Basic HTTP authentication (via username and password) is supported.

## Future work

Contributions and/or feature requests are welcome to support more patterns or additional use cases.
