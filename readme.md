# renovate

> Keep npm dependencies up-to-date

##  Why

- Creates or updates Pull Requests for each dependency that needs updating
- Discovers and processes all `package.json` files in repository (supports monorepo architecture)
- Supports multiple major versions per-dependency at once
- Configurable via file, environment, CLI, and `package.json`
- Self-hosted

## Install

```
$ npm install -g renovate
```

## Authentication

You need to select a GitHub user for `renovate` to assume the identity of. It's recommended that you use a dedicated "bot" account for this to avoid user confusion.

The script will need a GitHub Personal Access Token with "repo" permissions. You can find instructions for generating it here: https://help.github.com/articles/creating-an-access-token-for-command-line-use/

This token needs to be configured via file, environment variable, or CLI. See [docs/configuration.md](docs/configuration.md) for details.
The simplest way is to expose it as `GITHUB_TOKEN`.

## Usage

```
$ node renovate --help

  Usage: renovate [options] [repositories...]

  Options:

    -h, --help                        output usage information
    --enabled [boolean]               Enable or disable renovate
    --token <string>                  GitHub Auth Token
    --package-files <list>            Package file paths
    --dep-types <list>                Dependency types
    --ignore-deps <list>              Dependencies to ignore
    --ignore-future [boolean]         Ignore versions tagged as "future"
    --ignore-unstable [boolean]       Ignore versions with unstable semver
    --respect-latest [boolean]        Ignore versions newer than npm "latest" version
    --recreate-closed [boolean]       Recreate PRs even if same ones were closed previously
    --recreate-unmergeable [boolean]  Close and recreate PR if it has a merge conflict
    --labels <list>                   Labels to add to Pull Request
    --assignees <list>                Assignees for Pull Request
    --log-level <string>              Logging level

  Examples:

    $ renovate --token abc123 singapore/lint-condo
    $ renovate --ignore-unstable=false --log-level verbose singapore/lint-condo
    $ renovate singapore/lint-condo singapore/package-test
```

## Deployment

See [deployment docs](docs/deploment.md) for details.

## Design Decisions

See [design decisions doc](docs/design-decisions.md) for details.
