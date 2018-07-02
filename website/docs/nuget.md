---
title: Nuget (.NET)
description: Nuget (.NET) dependencies support in Renovate
---

# Nuget

Renovate supports upgrading dependencies in `.csproj` files.

## Version Support

Only SDK-style `.csproj` files are currently supported. By default, this includes:

- .NET Core 1.0 and above
- .NET Standard class libraries
- Any `.csproj` in the SDK-style syntax

To convert your .NET Framework .csproj into an SDK-style project, one can follow the [following guide](https://natemcmaster.com/blog/2017/03/09/vs2015-to-vs2017-upgrade/).

## How It Works

1.  Renovate will search each repository for any files with a `.csproj` extension.
2.  Existing dependencies will be extracted from `<PackageReference>` tags
3.  Renovate will look up the latest version on [nuget.org](https://nuget.org) to determine if any upgrades are available
4.  If the source package includes a GitHub URL as its source, and has either a "changelog" file or uses GitHub releases, then Release Notes for each version will be embedded in the generated PR.

## Future work

Contributions and/or feature requests are welcome to support more patterns or additional use cases.
