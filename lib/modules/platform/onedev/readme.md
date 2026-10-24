# OneDev

OneDev is an experimental platform for Renovate. It adds support for the
self-hosted [OneDev](https://docs.onedev.io) Git server.

## Authentication

Renovate authenticates against OneDev with HTTP Basic auth, both for the REST
API and for git operations.

1. In OneDev, open your user profile and create an **access token** (or use the
   account password).
2. Set the `RENOVATE_TOKEN` environment variable to `username:token`, for
   example `renovate-bot:<access-token>`.
   - The username is the OneDev user name.
   - When only a token (without `username:`) is given, the username defaults
     to `user`, which OneDev accepts for personal access tokens.
3. The token's user needs the permission to read the project, clone the
   repository, push commits, and open pull requests.

You must set the [`platform`](../../../self-hosted-configuration.md#platform)
config option to `onedev` in your admin config file. The
[`endpoint`](../../../self-hosted-configuration.md#endpoint) option should
point to your OneDev server, e.g. `https://onedev.example.com` (the `~api`
REST suffix is added automatically if missing).

## Feature support

Because OneDev has not enabled this integration officially, some features work
differently or not at all:

| Feature                | Status                                                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Branch updating        | Fully supported                                                                                                                  |
| PR creation            | Fully supported                                                                                                                  |
| PR automerge           | Fully supported (via OneDev's "auto merge when checks pass" feature)                                                             |
| Find/update PR         | Fully supported                                                                                                                  |
| Comments               | Not implemented (OneDev's REST API does not expose PR comment creation)                                                          |
| PR labels              | Not implemented (labels exist in OneDev, but are project-scoped specs not manageable via REST)                                   |
| Issues automation      | Supported (Renovate's dashboard issues are created in the project, with `confidential` support)                                  |
| PR reviews/assignments | Supported (user names are resolved through OneDev's user directory)                                                              |
| File contents via REST | Not implemented; files of the _current_ repository are read from the git clone (`getRawFile` supports only the initialized repo) |

## Known limitations

- OneDev does not expose the default branch through its REST API, so Renovate
  detects it from the cloned repository (`main` is preferred, then `master`,
  then the first branch in the list).
- Issue closing assumes the project uses OneDev's default issue states
  (`Open` and `Closed`). Custom issue state workflows cannot be closed
  automatically; a warning is logged in that case.
- Merging a PR uses the project's default merge strategy unless Renovate's
  configured strategy is mapped:
  `merge-commit` → `CREATE_MERGE_COMMIT`,
  `squash` → `SQUASH_SOURCE_BRANCH_COMMITS`,
  `rebase` → `REBASE_SOURCE_BRANCH_COMMITS`,
  `rebase-merge` → `CREATE_MERGE_COMMIT`,
  `fast-forward` → `CREATE_MERGE_COMMIT_IF_NECESSARY`.
- Renovate's `getRawFile`/`getJsonFile` APIs fall back to the local git clone;
  manager features which require raw file lookups through the API (e.g. gitlab
  `include` support) are not affected.

## Automerge

Renovate supports OneDev's native auto-merge: when
`platformAutomerge` is enabled and a PR's checks pass, OneDev merges the
pull request automatically using the project's default merge strategy.
