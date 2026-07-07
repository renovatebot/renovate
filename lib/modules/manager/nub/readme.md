Used for updating projects that use [nub](https://nubjs.com) as their package manager.
nub is a tool for JavaScript projects and therefore an alternative to managers like npm, pnpm and Yarn.

nub's `nub.lock` is the pnpm lockfile v9 format under nub's own filename, so dependencies resolve through the same npm datasource as the `npm` and `bun` managers.

If a `package.json` is found to be part of `nub` manager results then the same file will be excluded from the `npm` manager results unless an npm/pnpm/Yarn lock file is also found.
