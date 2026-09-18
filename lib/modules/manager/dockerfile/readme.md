### Supported dependencies

This manager extracts image references in a `Dockerfile` and/or `Containerfile` and supports:

- [`FROM`](https://docs.docker.com/reference/dockerfile/#from) images
- [`COPY --from`](https://docs.docker.com/reference/dockerfile/#copy---from) images
- [`RUN --mount`](https://docs.docker.com/reference/dockerfile/#run---mount) images
- [`syntax`](https://docs.docker.com/reference/dockerfile/#syntax) images
- APK packages pinned by `apk add` in [`RUN`](https://docs.docker.com/reference/dockerfile/#run) instructions
- Debian packages pinned by `apt install` or `apt-get install` in [`RUN`](https://docs.docker.com/reference/dockerfile/#run) instructions

#### `FROM` support

Renovate can update images referenced in `FROM` directives.
This even works for multi-stage builds with many `FROM` directives in one Dockerfile.

```dockerfile
FROM node:20.9.0
```

Advanced `FROM` flags like `--platform` or `AS <name>` are also supported:

```dockerfile
FROM --platform=linux/amd64 node:20.9.0 AS installer
```

Also, Renovate will automatically expand variables and [`ARG` directives](https://docs.docker.com/reference/dockerfile/#understand-how-arg-and-from-interact):

```dockerfile
ARG TAG=3.19.4
FROM alpine:${TAG}
```

Renovate supports variables with default values (using the `:-` syntax) when they are configured with registry aliases:

```dockerfile
FROM ${CI_REGISTRY:-}alpine:3.19.4
```

```json
{
  "registryAliases": {
    "${CI_REGISTRY:-}": "my-registry.io"
  }
}
```

Both image reference formats work:

- With a slash after the variable: `${CI_REGISTRY:-}/alpine:3.19.4`
- Without a slash after the variable: `${CI_REGISTRY:-}alpine:3.19.4`

The alias value works with or without a trailing slash.

#### `COPY --from` support

Renovate can update images referenced in `COPY --from` directives.

```dockerfile
FROM node:20.9.0
COPY --from alpine:3.19.4 /bin/sh /usr/local/sh
```

#### `RUN --mount` support

Images referenced in `RUN --mount` directives are also supported.

```dockerfile
FROM python:3.12
RUN --mount=from=ghcr.io/astral-sh/uv:0.5,source=/uv,target=/bin/uv \
    uv venv
```

#### `syntax` support

Renovate can update `syntax` references.

```dockerfile
# syntax=docker/dockerfile:1.9.0
FROM alpine:3.19.4
```

#### `RUN apk add` support

Renovate extracts Alpine packages installed via `apk add`, using the [`apk` datasource](../../datasource/apk/index.md).

```dockerfile
FROM alpine:3.21
RUN apk add --no-cache \
      bash=5.2.37-r2 \
      rsyslog=8.2412.0-r1
```

Renovate does _not_ configure a `registryUrl` for you, because the package repository depends on the base image and you may prefer an internal mirror.
Until you set one, the `apk` datasource falls back to its default registry, which may not match your base image.
Set the `registryUrls` which match your base image with a `packageRules` entry:

<!-- TODO: #45706 auto-detect `registryUrl` -->

```json title="Point apk lookups at the Alpine 3.21 repositories"
{
  "packageRules": [
    {
      "matchFileNames": ["Dockerfile"],
      "matchDatasources": ["apk"],
      "registryUrls": [
        "https://dl-cdn.alpinelinux.org/alpine?branch=v3.21&components=main,community&arch=x86_64"
      ]
    }
  ]
}
```

Version constraints are read with [`apk` versioning](../../versioning/apk/index.md), so the fuzzy constraints which Wolfi and Chainguard images commonly pin with are supported too:

```dockerfile
FROM cgr.dev/chainguard/wolfi-base
RUN apk add --no-cache curl=~8.12.1
```

`~8.12.1` matches every `8.12.1-rN`, so Renovate only raises a PR once a version outside the constraint is released, and keeps the precision you wrote it with - `curl=~8.13.0`, not `curl=~8.13.0-r0`.

Renovate skips packages which it cannot update, and says why in the `packageFiles with updates` log line:

- packages without a version, e.g. `apk add bash`
- packages whose version comes from a variable, e.g. `apk add "bash=$BASH_VERSION"`
- packages constrained to an identity hash with `><`, which is not a version

Renovate also proposes no new value for the `<`, `<=`, `>`, `>=`, `>~` and `<~` operators, as there is no single obvious new bound for them.

Local or remote `.apk` files, virtual packages (`--virtual .build-deps`) and provider dependencies (`so:`, `cmd:`, `pc:`) are ignored.

Packages installed by a system package manager use the `install` `depType`, so you can match them in a `packageRules` entry with `matchDepTypes`:

```json
{
  "packageRules": [
    {
      "description": "Disable APK package updates",
      "matchDepTypes": ["install"],
      "matchDatasources": ["apk"],
      "enabled": false
    }
  ]
}
```

#### `RUN apt install` support

Renovate extracts Debian packages installed via `apt install` or `apt-get install`, using the [`deb` datasource](../../datasource/deb/index.md).

```dockerfile
FROM debian:trixie
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       curl=8.14.1-2 \
       git=1:2.47.3-0+deb13u1 \
  && rm -rf /var/lib/apt/lists/*
```

The `deb` datasource needs a `registryUrl` which says which suite, components and architecture to look in, and Renovate does _not_ work that out from your base image.
Until you set one, the `deb` datasource falls back to the Debian `stable` suite for `amd64`, which may not match your base image.
Set the `registryUrls` which match your base image with a `packageRules` entry:

<!-- TODO: #45706 auto-detect `registryUrl` -->

```json title="Point deb lookups at the Debian trixie repositories"
{
  "packageRules": [
    {
      "matchFileNames": ["Dockerfile"],
      "matchDatasources": ["deb"],
      "registryUrls": [
        "https://deb.debian.org/debian?suite=trixie&components=main,contrib,non-free&binaryArch=amd64"
      ]
    }
  ]
}
```

Renovate skips packages which it cannot update, and says why in the `packageFiles with updates` log line:

- packages without a version, e.g. `apt-get install -y curl`
- packages pinned to a suite instead of a version, e.g. `apt-get install -y curl/trixie-backports`
- packages whose version comes from a variable, e.g. `apt-get install -y "curl=$CURL_VERSION"`
  This can be handled with a Custom Manager, instead.
- packages given a wildcard version, e.g. `apt-get install -y 'curl=8.14.*'`

Local or remote `.deb` files, removal markers like `vim-` and pattern matches like `^gnome` are ignored.
`dpkg -i` is not supported, because it installs a local file rather than a package from a repository.

Packages installed by a system package manager use the `install` `depType`, so you can match them in a `packageRules` entry with `matchDepTypes`:

```json
{
  "packageRules": [
    {
      "description": "Disable Debian package updates",
      "matchDepTypes": ["install"],
      "matchDatasources": ["deb"],
      "enabled": false
    }
  ]
}
```

### Versioning

Renovate's managers does not understand versioning, that's up to Renovate's versioning modules.
The default `docker` versioning for container image datasources treats suffixes as "compatibility", for example: `-alpine`.
Many container images are _not_ SemVer compliant because they use such suffixes in their tags.

If Renovate does not update your container images correctly, you may need to tell Renovate what versioning it should use.
For example, if you know that an image follows SemVer, you can tell Renovate to use `"semver"` versioning for that image:

```json
{
  "packageRules": [
    {
      "matchDatasources": ["docker"],
      "matchPackageNames": ["whitesource/renovate"],
      "versioning": "semver"
    }
  ]
}
```

Read [Renovate's Docker Versioning](../../versioning/docker/index.md) docs to learn more.
