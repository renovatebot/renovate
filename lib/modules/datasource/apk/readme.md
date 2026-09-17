The APK datasource is designed to work with Alpine Linux package repositories.
It can fetch package information from APK repositories and provide version updates for Alpine Linux packages.

Alpine Linux uses the APK package manager, and packages are distributed through repositories.
Each repository contains an `APKINDEX.tar.gz` file that contains metadata about all available packages.

Files are typically located in this structure:

```
https://dl-cdn.alpinelinux.org/alpine/v3.19/main/x86_64/APKINDEX.tar.gz
https://dl-cdn.alpinelinux.org/alpine/v3.19/community/x86_64/APKINDEX.tar.gz
```

## Set URL when using an APK repository

To use an APK repository with the datasource, you must set a properly formatted URL with specific query parameters as `registryUrl`:

- `arch`: Architecture of the binary packages (e.g. `x86_64`, `aarch64`, `armv7`).
- `branch`: Alpine branch, either a rolling alias like `latest-stable` or `edge`, or a fixed release like `v3.19`.
  Omit this parameter for repositories which do not have a branch in their path.
- `components`: Comma-separated list of repository components (e.g. `main,community,testing`).
  Omit this parameter for repositories which serve their index directly below the repository root.

!!! note
  Renovate does not fetch the `registryUrl` as-is.
  It combines the base URL with these parameters to build the actual index URLs, for example `<base>/<branch>/<component>/<arch>/APKINDEX.tar.gz`.
  Only the parameters above are accepted, so that a typo fails loudly instead of being ignored.

**Examples**:

```
https://dl-cdn.alpinelinux.org/alpine?branch=v3.19&components=main,community&arch=x86_64
https://packages.wolfi.dev/os?arch=x86_64
```

The first URL points to the `v3.19` branch of the Alpine repository for the `x86_64` architecture, including the `main` and `community` components.
Renovate looks up the package in every component you list, and aggregates the releases it finds.

The second URL points to the Wolfi repository, which has no branch or component in its path.

### How Renovate builds the index URLs

Say you set this `registryUrl` in your Renovate config:

```json title="Set the apk registryUrl in renovate.json"
{
  "packageRules": [
    {
      "matchDatasources": ["apk"],
      "registryUrls": [
        "https://dl-cdn.alpinelinux.org/alpine?branch=v3.19&components=main,community&arch=x86_64"
      ]
    }
  ]
}
```

Renovate then fetches one index per component:

```
https://dl-cdn.alpinelinux.org/alpine/v3.19/main/x86_64/APKINDEX.tar.gz
https://dl-cdn.alpinelinux.org/alpine/v3.19/community/x86_64/APKINDEX.tar.gz
```

## Versioning

This datasource uses [`apk` versioning](../../versioning/apk/index.md) by default, which follows Alpine's version format (`3.2.1-r0`, `2.39.0_rc1-r0`, `6.5_p20250503-r0`) and understands APK's version constraints.

This means a `currentValue` may be a constraint rather than a plain version, e.g. `=~8.12.1` to accept any `8.12.1-rN`.
Read the [`apk` versioning](../../versioning/apk/index.md) docs for the operators it supports.

Depending on which APK repository you are using, you may want to use [the `loose` versioning scheme](../../versioning/loose/index.md), like so:

```json title="Specify loose versioning for apk lookups"
{
  "packageRules": [
    {
      "matchDatasources": ["apk"],
      "versioning": "loose"
    }
  ]
}
```

## Dockerfile support

When using distributions built on `apk` packages, it is common to use a version pin for your packages, like so:

```dockerfile
FROM alpine:3.18
RUN apk add --no-cache bash=5.2.37-r2
```

This provides reproducibility in the case that the upstream package updates under you.

The [`dockerfile` manager](../../manager/dockerfile/index.md) extracts these packages, allowing updates to them directly, without needing a Custom Manager.

The manager does not set a `registryUrl`, so you will need to set one which matches your base image as shown above.

<!-- TODO: #45706 auto-detect `registryUrl` -->

```json title="Override apk registryUrl with a packageRules entry"
{
  "packageRules": [
    {
      "matchFileNames": ["Dockerfile"],
      "matchDatasources": ["apk"],
      "matchPackageNames": ["nginx"],
      "registryUrls": [
        "https://dl-cdn.alpinelinux.org/alpine?branch=v3.18&components=main,community&arch=x86_64"
      ]
    }
  ]
}
```
