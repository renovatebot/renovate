# OneDev

OneDev is an experimental platform for Renovate. It adds support for the
self-hosted [OneDev](https://docs.onedev.io) Git server.

## Authentication

Renovate authenticates against OneDev with HTTP Basic auth, both for the REST
API and for git operations.

1. In OneDev, open your user profile and create an **access token** (or use the
   account password).
2. Set the `RENOVATE_TOKEN` (or `RENOVATE_PASSWORD`) environment variable to
   the access token, and set `RENOVATE_USERNAME` to the OneDev user name, e.g.
   `renovate-bot`.
   - The token's user needs the permission to read the project, clone the
     repository, push commits, and open pull requests.
   - When no username is configured, `user` is assumed, which OneDev accepts
     for personal access tokens. If you authenticate with the **account
     password** instead of an access token, you must configure the correct
     username.
   - The token (or password) is used as-is; Renovate does not support a
     combined `username:token` token string, so set the `username` option
     separately.

You must set the [`platform`](../../../self-hosted-configuration.md#platform)
config option to `onedev` in your admin config file. The
[`endpoint`](../../../self-hosted-configuration.md#endpoint) option should
point to your OneDev server, e.g. `https://onedev.example.com` (the `~api`
REST suffix is added automatically if missing).

## Feature support

| Feature                | Status                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Branch updating        | Fully supported                                                                                                                                                                            |
| PR creation            | Fully supported                                                                                                                                                                            |
| PR automerge           | Fully supported (via OneDev's "auto merge when checks pass" feature)                                                                                                                       |
| Find/update PR         | Fully supported                                                                                                                                                                            |
| Comments               | Fully supported (PR comments via the REST API)                                                                                                                                             |
| PR labels              | Not implemented (labels exist in OneDev, but are project-scoped specs not manageable via REST)                                                                                             |
| Issues automation      | Supported (Renovate's dashboard issues are created in the project, with `confidential` support; OneDev's built-in required issue fields `Type` and `Priority` are completed automatically) |
| PR reviews/assignments | Supported (user names are resolved through OneDev's user directory)                                                                                                                        |
| File contents          | Current repository read from the git clone; other projects (e.g. shared presets) read from the REST API                                                                                    |

## Known limitations

- OneDev's issue form may require field values. Renovate fills in OneDev's
  built-in `Type` and `Priority` fields with `Task` and `Normal` when the
  instance requires them (read from the admin-only issue settings,
  plus a fallback retry for non-admin accounts). If the form requires other
  fields without server-side defaults, Renovate gives up with a warning;
  configure defaults for those fields in OneDev or provide them through a
  script.

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
- OneDev's PR description editor re-saves the description without HTML
  comments and with normalized list indentation when a PR is edited in the web
  UI. Renovate restores its checkbox marker afterwards automatically, but
  avoid hand-editing Renovate PR descriptions in the OneDev UI.

## Automerge

Renovate supports OneDev's native auto-merge: when
`platformAutomerge` is enabled and a PR's checks pass, OneDev merges the
pull request automatically using the project's default merge strategy.
