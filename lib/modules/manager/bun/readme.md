Used for updating bun projects.
Bun is a tool for JavaScript projects and therefore an alternative to managers like npm, pnpm and Yarn.

If a `package.json` is found to be part of `bun` manager results then the same file will be excluded from the `npm` manager results unless an npm/pnpm/Yarn lock file is also found.

### `bunfig.toml` registry configuration

Renovate reads the [`[install]` registry configuration](https://bun.com/docs/pm/scopes-registries) from the `bunfig.toml` file next to the Bun lock file:

```toml
[install]
registry = "https://registry.example.com"

[install.scopes]
myorg = "https://registry.myorg.com"
```

Renovate looks up scoped packages like `@myorg/utils` in the matching scoped registry, and all other packages in the default `registry`.
Like Bun, Renovate reads the `bunfig.toml` file next to the lock file only, so workspace packages use the registries of the workspace root.
Also like Bun, a scoped registry from a `.npmrc` file still wins over the default `registry` from the `bunfig.toml` file.

Renovate ignores any credentials in the `bunfig.toml` file, including credentials in a registry URL.
Configure [`hostRules`](../../../configuration-options.md#hostrules) to let Renovate authenticate to a private registry.
