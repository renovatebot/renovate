Keeps Git submodules updated within a repository.

You can customize the per-submodule checks of the git-submodules manager like this:

```json
{
  "ignoreDeps": ["path/to/submodule", "path/to/submodule2"],
  "git-submodules": {
    "enabled": true
  }
}
```

### Updating to tag values

If you want to update your git submodules to a specific tag, you can set the current tag as `branch` in the `.gitmodules`-files and Renovate will update this version to the latest git tag.

```ini
[submodule "renovate"]
  path = deps/renovate
  url = https://github.com/renovatebot/renovate.git
  branch = v0.0.1
```

Notice: Using this will break the native git submodule update experience using `git submodule update --remote` with an error like `fatal: Unable to find refs/remotes ... revision in submodule path ...`.

### Private Modules Authentication

Before running the `git` commands to update the submodules, Renovate exports `git` [`insteadOf`](https://git-scm.com/docs/git-config#Documentation/git-config.txt-urlltbasegtinsteadOf) directives in environment variables.

The following logic is executed prior to "submodules" updating:

The token from the `hostRules` entry matching `hostType=github` and `matchHost=api.github.com` is added as the default authentication for `github.com`.
For those running against `github.com`, this token will be the default platform token.

Next, all `hostRules` with both a token or username/password and `matchHost` will be fetched, except for any github.com one from above.

Rules from this list are converted to environment variable directives if they match _any_ of the following characteristics:

- No `hostType` is defined, or
- `hostType` is `git-tags` or `git-refs`, or
- `hostType` is a platform (`github`, `gitlab`, `azure`, etc.)
