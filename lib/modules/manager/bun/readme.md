Used for updating bun projects.
Bun is a tool for JavaScript projects and therefore an alternative to managers like npm, pnpm and Yarn.

If a `package.json` is found to be part of `bun` manager results then the same file will be excluded from the `npm` manager results unless an npm/pnpm/Yarn lock file is also found.

### Catalogs

Renovate supports [Bun catalogs](https://bun.sh/docs/install/catalogs), which let you share dependency versions across workspace packages.
Catalog definitions are extracted from the root `package.json`, whether defined at the top level or nested under the `workspaces` object:

```json
{
  "workspaces": {
    "packages": ["packages/*"],
    "catalog": {
      "react": "^19.0.0"
    },
    "catalogs": {
      "testing": {
        "jest": "30.0.0"
      }
    }
  }
}
```

Catalog dependencies produce dynamic `depType` values: `bun.catalog.default` for the default catalog, and `bun.catalog.<name>` for named catalogs.
You can use these `depType` values in [`packageRules`](../../usage/configuration-options.md#packagerules) to target catalog dependencies specifically.
