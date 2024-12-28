The `mix` manager extracts prod for the `hex` datasource and uses Renovate's implementation of Hex SemVer to evaluate updates.

The `mix` package manager itself is also used to keep the lock file up-to-date.

The following `depTypes` are currently supported by the mix manager :

- `prod`: all dependencies by default
- `dev`: dependencies with [`:only` option](https://hexdocs.pm/mix/1.18.1/Mix.Tasks.Deps.html#module-dependency-definition-options) not containing `:prod`
