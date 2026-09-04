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

<!-- TODO #43711 -->

## Usage example

Say you pin Alpine packages in a `Dockerfile` and want Renovate to bump the versions.
Combine the `apk` datasource with a [regex manager](../../manager/regex/index.md).

Add a custom manager in `renovate.json`.
The optional `branch` capture group is filled from the Renovate comment and interpolated into `registryUrlTemplate` by the regex manager.

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "customManagers": [
    {
      "customType": "regex",
      "managerFilePatterns": ["/^Dockerfile$/"],
      "matchStrings": [
        "#\\s*renovate:\\s*(?:branch=(?<branch>\\S+)\\s+)?depName=(?<depName>\\S+)\\s+ENV .*?_VERSION=\"(?<currentValue>.*)\""
      ],
      "registryUrlTemplate": "https://dl-cdn.alpinelinux.org/alpine?branch={{#if branch}}{{branch}}{{else}}v3.19{{/if}}&components=main,community&arch=x86_64",
      "datasourceTemplate": "apk"
    }
  ]
}
```

The regex manager supplies `depName` (becomes `packageName`) and `currentValue` (the pinned APK version).
The datasource then fetches `APKINDEX.tar.gz` for each component, finds `depName` in the index, and compares versions.

Match the `registryUrl` parameters to your image: the Alpine branch (`v3.19` in the default above) and the architecture (`x86_64` here, use `aarch64` on arm64).

```dockerfile
FROM alpine:3.19

# renovate: branch=v3.19 depName=nginx
ENV NGINX_VERSION="1.26.2-r0"

RUN apk add --no-cache "nginx=${NGINX_VERSION}"
```

`depName` must match the package name in `APKINDEX` (the `P:` field), e.g. `nginx` for the `nginx` package.
You can omit `branch=` in the comment when the template default (`v3.19` above) matches your Alpine line.

### Multiple Dockerfiles or Alpine versions

The datasource receives one `registryUrl` per lookup.
Besides the optional `branch=` pattern in the usage example, you can:

1. **Several custom managers** with different `managerFilePatterns` / `matchFilePatterns` and a fixed `registryUrlTemplate` each (e.g. one for `docker/alpine-3.18/**`, another for `docker/alpine-3.19/**`).

1. **`packageRules`** with `matchFileNames` / `matchPaths` and `registryUrls` to override the parameters for specific paths or packages.

For example, this `packageRules` entry overrides the `registryUrl` for the `nginx` package:

```json title="Override apk registryUrl with a packageRules entry"
{
  "packageRules": [
    {
      "matchDatasources": ["apk"],
      "matchPackageNames": ["nginx"],
      "registryUrls": [
        "https://dl-cdn.alpinelinux.org/alpine?branch=v3.18&components=main,community&arch=x86_64"
      ]
    }
  ]
}
```
