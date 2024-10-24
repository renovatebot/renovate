Renovate can update `gleam.toml` and/or `manifest.toml` files.

The `gleam` manager can update these `depTypes`:

- `dependencies`
- `dev-dependencies`

### How Renovate updates `gleam.toml` files

The `gleam` manager extracts dependencies for the `hex` datasource, and uses Renovate's implementation of Hex SemVer to evaluate `gleam.toml` updates.

### How Renovate updates `manifest.toml` files

The `gleam` manager uses the `gleam` program to update `manifest.toml` files.

### Enable `lockFileMaintenance`

We recommend you set [`lockFileMaintenance`](../../../configuration-options.md#lockfilemaintenance) to `true` for the `gleam` manager, in your Renovate config.
This way Renovate can update all your dependencies, including those with in-range updates.

`lockFileMaintenance=true` periodically refreshes your `manifest.toml` files, ensuring all dependencies are updated to their latest allowed versions.

### Default `rangeStrategy=auto` behavior

Renovate's default [`rangeStrategy`](../../../configuration-options.md#rangestrategy) is `"auto"`.
Here's how `"auto"` works with the `gleam` manager:

| Version type             | New version | Old range                | New range after update   | What Renovate does                                                        |
| :----------------------- | :---------- | :----------------------- | :----------------------- | :------------------------------------------------------------------------ |
| Complex range            | `0.16.0`    | `>= 0.14.0 and < 0.15.0` | `>= 0.14.0 and < 0.16.1` | Widen range to include the new version.                                   |
| Simple range             | `0.39.0`    | `<= 0.38.0`              | `<= 0.39.0`              | If update outside current range: widens range to include the new version. |
| Exact version constraint | `0.13.0`    | `== 0.12.0`              | `== 0.13.0`              | Replace old version with new version.                                     |

### Recommended `rangeStrategy` for apps and libraries

For applications, we recommend using `rangeStrategy=pin`.
This pins your dependencies to exact versions, which is generally considered [best practice for apps](../../../dependency-pinning.md).

For libraries, use `rangeStrategy=widen` with version ranges in your `gleam.toml`.
This allows for greater compatibility with other projects that may use your library as a dependency.
