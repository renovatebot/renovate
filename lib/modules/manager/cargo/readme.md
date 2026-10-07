Extracts dependencies from `Cargo.toml` files, and also updates `Cargo.lock` files too if found.

When using the default rangeStrategy=auto:

- If a "less than" instruction is found (e.g. `<2`) then `rangeStrategy=widen` will be selected,
- Otherwise, `rangeStrategy=update-lockfile` will be selected.

The `update-lockfile` default means that most upgrades will update `Cargo.lock` files without the need to change the value in `Cargo.toml`.

### Private Modules Authentication

Before running the `cargo` commands to update the `cargo.lock`, Renovate exports `git` [`insteadOf`](https://git-scm.com/docs/git-config#Documentation/git-config.txt-urlltbasegtinsteadOf) directives in environment variables.

Renovate uses this logic before it updates any "artifacts":

The token from the `hostRules` entry matching `hostType=github` and `matchHost=api.github.com` is added as the default authentication for `github.com`.
For those running against `github.com`, this token will be the default platform token.

Next, all `hostRules` with both a token or username/password and `matchHost` will be fetched, except for any `github.com` one from above.

Rules from this list are converted to environment variable directives if they match _any_ of these characteristics:

- No `hostType` is defined, or
- `hostType` is `cargo` or `crate`, or
- `hostType` is a platform (`github`, `gitlab`, `azure`, etc.)

### Git index registries

When Renovate clones a git index registry over `http(s)` to look up versions, it exports the same `insteadOf` directives as for artifact updates, with `hostType=crate` in place of `hostType=cargo`.
Because artifact updates accept `hostType=crate` rules too, a single `crate` rule covers both the lookup and the `Cargo.lock` update.
Git uses the credentials of the directive whose URL matches the index URL.
Cloning a git index registry other than the crates.io index (`https://index.crates.io/`) requires `allowCustomCrateGitRegistries`.
Sparse registries (`sparse+https://`) are fetched over HTTP, and use `hostRules` like other datasources.
