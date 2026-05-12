The APK datasource is designed to work with Alpine Linux package repositories.
It can fetch package information from APK repositories and provide version updates for Alpine Linux packages.

Alpine Linux uses the APK package manager, and packages are distributed through repositories.
Each repository contains an `APKINDEX.tar.gz` file that contains metadata about all available packages.

Files are typically located in this structure:

```
https://dl-cdn.alpinelinux.org/alpine/v3.19/main/x86_64/APKINDEX.tar.gz
https://dl-cdn.alpinelinux.org/alpine/v3.19/community/x86_64/APKINDEX.tar.gz
```

Example APK repository URLs:

- Official Alpine Linux repositories (e.g., `https://dl-cdn.alpinelinux.org/alpine/v3.19/main`)
- Community repositories (e.g., `https://dl-cdn.alpinelinux.org/alpine/v3.19/community`)
- Wolfi APK repositories (e.g., `https://packages.wolfi.dev/os`)

## Usage example

Say you pin Alpine packages in a `Dockerfile` and want Renovate to bump the versions.
Combine the `apk` datasource with a [regex manager](../../manager/regex/index.md).

Add a custom manager in `renovate.json`. The optional `release` capture group is filled from the renovate comment and interpolated into `registryUrlTemplate` by the regex manager; the **`apk` datasource only sees the resulting directory `registryUrl`**.

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "customManagers": [
    {
      "customType": "regex",
      "managerFilePatterns": ["/^Dockerfile$/"],
      "matchStrings": [
        "#\\s*renovate:\\s*(?:release=(?<release>\\S+)\\s+)?depName=(?<depName>\\S+)\\s+ENV .*?_VERSION=\"(?<currentValue>.*)\""
      ],
      "registryUrlTemplate": "https://dl-cdn.alpinelinux.org/alpine/{{#if release}}{{release}}{{else}}v3.19{{/if}}/main/x86_64",
      "datasourceTemplate": "apk"
    }
  ]
}
```

The regex manager supplies `depName` (becomes `packageName`) and `currentValue` (the pinned APK version). It passes a single **`registryUrl`** built from the template. The datasource then fetches `APKINDEX.tar.gz` from that directory, finds `depName` in the index, and compares versions.

Match the `registryUrl` path to your image: Alpine branch (`v3.19` in the default below) and architecture (`x86_64` here; use `aarch64` on arm64). For other mirrors (e.g. Wolfi), point `registryUrlTemplate` at the appropriate directory URL.

```dockerfile
FROM alpine:3.19

# renovate: release=v3.19 depName=nginx
ENV NGINX_VERSION="1.26.2-r0"

RUN apk add --no-cache "nginx=${NGINX_VERSION}"
```

`depName` must match the package name in `APKINDEX` (the `P:` field), e.g. `nginx` for the `nginx` package. You can omit `release=` in the comment when the template default (`v3.19` above) matches your Alpine line.

### Multiple Dockerfiles or Alpine versions

The datasource still only receives one directory `registryUrl` per lookup. Besides the optional `release=` pattern in the usage example, you can:

1. **Several custom managers** with different `managerFilePatterns` / `matchFilePatterns` and a fixed `registryUrlTemplate` each (e.g. one for `docker/alpine-3.18/**`, another for `docker/alpine-3.19/**`).

1. **`packageRules`** with `matchFileNames` / `matchPaths` and `registryUrls` to override the directory URL for specific paths or packages.
