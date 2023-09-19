Used for updating bun projects.
Bun is a tool for JavaScript projects and therefore an alternative to managers like npm, pnpm and Yarn.

If a `package.json` is found to be part of `bun` manager results then the same file will be excluded from the `npm` manager results so that it's not duplicated.
This means that supporting a `bun.lockb` file in addition to other JS lock files is not supported - Bun will take priority.
