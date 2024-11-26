### Supported dependencies

This manager extracts image references in a `Dockerfile` and/or `Containerfile` and supports:

- [`FROM`](https://docs.docker.com/reference/dockerfile/#from) images
- [`COPY --from`](https://docs.docker.com/reference/dockerfile/#copy---from) images
- [`RUN --mount`](https://docs.docker.com/reference/dockerfile/#run---mount) images
- [`syntax`](https://docs.docker.com/reference/dockerfile/#syntax) images

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
