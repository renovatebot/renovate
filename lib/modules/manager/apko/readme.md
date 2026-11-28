Renovate updates apk packages in an [apko](https://github.com/chainguard-dev/apko) image configuration.

### Package files

Renovate reads `contents.packages` from `apko.yaml` and `apko.yml`.
Package specs use the [`apk` datasource](../../datasource/apk/index.md) and [`apk` versioning](../../versioning/apk/index.md).

`contents.repositories` and `contents.build_repositories` become registry URLs, one per architecture.
Renovate ignores `contents.runtime_repositories`.
An `archs` list of `all`, or a missing `archs` list, uses apko's default architectures.

Renovate does not follow `include`.
Packages in an included file are extracted only when that file is read on its own.

### Lock file

When `apko.lock.json` (or `<name>.lock.json` beside another YAML name) already exists, Renovate runs `apko lock` to regenerate it.
Renovate does not create a lock file that is absent.

Set [`constraints.apko`](../../../configuration-options.md#constraints) to the apko release Renovate should install.
