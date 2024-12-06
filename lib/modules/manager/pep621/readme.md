This manager supports updating dependencies inside `pyproject.toml` files.

In addition to standard dependencies, these toolsets are also supported:

- `pdm` (including `pdm.lock` files)
- `uv` (including `uv.lock` files)
- `hatch`

Available `depType`s:

- `project.dependencies`
- `project.optional-dependencies`
- `dependency-groups`
- `build-system.requires`
- `tool.pdm.dev-dependencies`
- `tool.uv.dev-dependencies`
- `tool.uv.sources`
- `tool.hatch.envs.<env-name>`

### Private Modules Authentication

Before running the `pdm` or `uv` commands to update the `pdm.lock` or `uv.lock` respectively, Renovate exports `git` [`insteadOf`](https://git-scm.com/docs/git-config#Documentation/git-config.txt-urlltbasegtinsteadOf) directives in environment variables.

Renovate uses this logic before it updates any "artifacts":

The token from the `hostRules` entry matching `hostType=github` and `matchHost=api.github.com` is added as the default authentication for `github.com`.
For those running against `github.com`, this token will be the default platform token.

Next, all `hostRules` with both a token or username/password and `matchHost` will be fetched, except for any `github.com` one from above.

Rules from this list are converted to environment variable directives if they match _any_ of these characteristics:

- No `hostType` is defined, or
- `hostType` is `pep621`, or
- `hostType` is a platform (`github`, `gitlab`, `azure`, etc.)
