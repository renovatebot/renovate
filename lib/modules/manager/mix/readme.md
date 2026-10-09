The `mix` manager uses Renovate's implementation of [Elixir SemVer](https://hexdocs.pm/elixir/Version.html#module-requirements) to evaluate update ranges.

The `mix` package manager itself is used to keep the lock file up-to-date.

The following `depTypes` are currently supported by the `mix` manager :

- `prod`: all dependencies by default
- `dev`: dependencies with [`:only` option](https://hexdocs.pm/mix/Mix.Tasks.Deps.html#module-dependency-definition-options) not containing `:prod`

### Private organizations on hex.pm

For dependencies in a private [hex.pm organization](https://hex.pm/docs/private), add a `hostRule` matching the organization's API URL.
The token needs API read and organization access.

```elixir
{:private_package, "~> 1.0", organization: "your_org"}
```

```json
{
  "hostRules": [
    {
      "matchHost": "https://hex.pm/api/repos/your_org/",
      "token": "{{ secrets.HEX_TOKEN }}",
      "authType": "Token-Only"
    }
  ]
}
```

### Private registries

Dependencies with a `repo:` option come from a third-party registry instead of hex.pm.
Their URL cannot be discovered from `mix.exs`, so map the repo name to its URL with [`registryAliases`](../../../configuration-options.md#registryaliases), scoped to the `mix` manager.

```elixir
{:oban_pro, "~> 1.7", repo: "oban"}
```

```json
{
  "mix": {
    "registryAliases": {
      "oban": "https://repo.oban.pro"
    }
  },
  "hostRules": [
    {
      "matchHost": "https://repo.oban.pro",
      "token": "{{ secrets.OBAN_LICENSE_KEY }}",
      "authType": "Token-Only"
    }
  ]
}
```

The `registryAliases` key must match the `repo:` name in `mix.exs`, because `mix` verifies that the registry's signed metadata reports the same repository name it was configured under.
Only the repos that `mix.exs` declares are added, so aliases set for other managers are ignored.

`repo: "hexpm"` and `repo: "hexpm:<org>"` point at hex.pm itself, and need no alias: they are the explicit forms of the default registry and of `organization:` respectively.

Renovate fetches the registry's public key from `<url>/public_key` to satisfy `mix`, which refuses to fetch from a repo that has no stored key.
A registry that does not serve that endpoint is skipped.

!!! note
  `matchHost` matches on hostname and ignores any port.
  To target a registry on a non-default port, give the full URL form, such as `http://localhost:8123`.

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
