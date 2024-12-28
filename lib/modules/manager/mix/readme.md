The `mix` manager uses Renovate's implementation of [Elixir SemVer](https://hexdocs.pm/elixir/Version.html#module-requirements) to evaluate update ranges.

The `mix` package manager itself is used to keep the lock file up-to-date.

The following `depTypes` are currently supported by the `mix` manager :

- `prod`: all dependencies by default
- `dev`: dependencies with [`:only` option](https://hexdocs.pm/mix/Mix.Tasks.Deps.html#module-dependency-definition-options) not containing `:prod`
