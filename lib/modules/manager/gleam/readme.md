Renovate can update `gleam.toml` and/or `manifest.toml` files.

### How Renovate updates `gleam.toml` files

The `gleam` manager extracts dependencies for the `hex` datasource, and uses Renovate's implementation of Hex SemVer to evaluate `gleam.toml` updates.

Renovate updates dependencies whose requirement is a version range, either as a string or as a `version` table:

```toml
[dependencies]
gleam_stdlib = ">= 0.44.0 and < 2.0.0"
gleam_json = { version = ">= 3.0.0 and < 4.0.0" }
local_package = { path = "../local_package" }
git_package = { git = "https://github.com/example/git_package.git", ref = "main" }
```

Renovate skips `path` and `git` dependencies, and still updates the rest of the file.

### How Renovate updates `manifest.toml` files

The `gleam` manager uses the `gleam` program to update `manifest.toml` files.

### Enable `lockFileMaintenance`

We recommend you set [`lockFileMaintenance`](../../../configuration-options.md#lockfilemaintenance) to `true` for the `gleam` manager, in your Renovate config.
This way Renovate can update all your dependencies, including those with in-range updates.

`lockFileMaintenance=true` periodically refreshes your `manifest.toml` files, ensuring all dependencies are updated to their latest allowed versions.

### Default `rangeStrategy=auto` behavior

Renovate's default [`rangeStrategy`](../../../configuration-options.md#rangestrategy) is `"auto"`.
Here is how `"auto"` works with the `gleam` manager:

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
