The `mix` manager uses Renovate's implementation of [Elixir SemVer](https://hexdocs.pm/elixir/Version.html#module-requirements) to evaluate update ranges.

The `mix` package manager itself is used to keep the lock file up-to-date.

The following `depTypes` are currently supported by the `mix` manager :

- `prod`: all dependencies by default
- `dev`: dependencies with [`:only` option](https://hexdocs.pm/mix/Mix.Tasks.Deps.html#module-dependency-definition-options) not containing `:prod`

### `lockFileMaintenance`

We recommend you use [`lockFileMaintenance`](../../../configuration-options.md#lockfilemaintenance) for the `mix` manager.

`lockFileMaintenance=true` periodically refreshes your `mix.lock` files, ensuring all indirect dependencies are updated to their latest allowed versions.

This option will be skipped in [umbrella projects](https://hexdocs.pm/elixir/dependencies-and-umbrella-projects.html#umbrella-projects), as they share a single
`mix.lock` file for all applications `mix.exs` files.

### Default `rangeStrategy=auto` behavior

Renovate's default [`rangeStrategy`](../../../configuration-options.md#rangestrategy) is `"auto"`.
Here's how `"auto"` works with the `mix` manager:

| Version type             | New version | Old range             | New range after update | What Renovate does                                                        |
| :----------------------- | :---------- | :-------------------- | :--------------------- | :------------------------------------------------------------------------ |
| Complex range            | `1.7.2`     | `< 1.7.0 or ~> 1.7.1` | `< 1.7.0 or ~> 1.7.2`  | Widen range to include the new version.                                   |
| Simple range             | `0.39.0`    | `<= 0.38.0`           | `<= 0.39.0`            | If update outside current range: widens range to include the new version. |
| Exact version constraint | `0.13.0`    | `== 0.12.0`           | `== 0.13.0`            | Replace old version with new version.                                     |

### Recommended `rangeStrategy` for apps and libraries

For applications, we recommend using `rangeStrategy=pin`.
This pins your dependencies to exact versions, which is generally considered [best practice for apps](../../../dependency-pinning.md).

For libraries, use `rangeStrategy=widen` with version ranges in your `mix.exs`.
This allows for greater compatibility with other projects that may use your library as a dependency.
