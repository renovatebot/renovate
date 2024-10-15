Keeps Copier templates up to date.
Supports multiple `.copier-answers(...).y(a)ml` files in a single repository.
If a template requires unsafe features, Copier must be invoked with the `--trust` flag.
Enabling this behavior must be allowed in the [self-hosted configuration](../../../self-hosted-configuration.md) via `allowScripts`.
Actually enable it in the [configuration](../../../configuration-options.md) by setting `ignoreScripts` to `false`.

If you need to change the versioning format, read the [versioning](../../versioning/index.md) documentation to learn more.

### Private Modules Authentication

Before running the `copier` command to update from the template, Renovate exports `git` [`insteadOf`](https://git-scm.com/docs/git-config#Documentation/git-config.txt-urlltbasegtinsteadOf) directives in environment variables.

Renovate uses this logic before it updates the template copy:

The token from the `hostRules` entry matching `hostType=github` and `matchHost=api.github.com` is added as the default authentication for `github.com`.
For those running against `github.com`, this token will be the default platform token.

Next, all `hostRules` with both a token or username/password and `matchHost` will be fetched, except for any `github.com` one from above.

Rules from this list are converted to environment variable directives if they match _any_ of these characteristics:

- No `hostType` is defined, or
- `hostType` is `git-tags`, or
- `hostType` is a platform (`github`, `gitlab`, `azure`, etc.)
