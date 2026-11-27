Used for updating aube projects.
Aube is a package manager for JavaScript projects and therefore an alternative to managers like npm, pnpm and Yarn.

If a `package.json` is found to be part of `aube` manager results then the same file will be excluded from the `npm` manager results unless an npm/pnpm/Yarn lock file is also found.

Renovate picks the aube version for `aube install` in this order:

1. The `constraints.aube` config option
1. `engines.aube` or the `packageManager` field in `package.json`
1. The latest aube release
