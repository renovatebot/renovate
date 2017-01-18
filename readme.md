# renovate

> Keep npm dependencies up-to-date

##  Why

- Creates or updates Pull Requests for each dependency that needs updating
- Discovers and processes all `package.json` files in repository (supports monorepo architecture)
- Supports multiple major versions per-dependency at once
- Configurable via file, environment, CLI, and `package.json`
- Self-hosted

Inspired by the services at [Greenkeeper](https://greenkeeper.io) and [Doppins](https://doppins.com).

## Install

```
$ npm install -g renovate
```

## Authentication

You need to select a GitHub user for `renovate` to assume the identity of. It's recommended that you use a dedicated "bot" account for this to avoid user confusion.

The script will need a GitHub Personal Access Token with "repo" permissions. You can find instructions for generating it here: https://help.github.com/articles/creating-an-access-token-for-command-line-use/

This token needs to be configured via file, environment variable, or CLI. See [docs/configuration.md](docs/configuration.md) for details.
The simplest way is to expose it as `GITHUB_TOKEN`.

## Usage (CLI)

```
$ node renovate --help

  Usage: renovate [options] [repositories...]

  Options:

    -h, --help                               output usage information
    -t, --token <token>                      GitHub Auth Token
    -p, --package-files <list>               List of package.json file names
    -d, --dep-types <list>                   List of dependency types
    -i, --ignore-deps <list>                 List of dependencies to ignore
    -b, --labels <list>                      List of labels to add
    -b, --assignees <list>                   List of assignees to add
    -r, --ignore-future [true/false]         Ignore versions tagged as "future"
    -r, --ignore-unstable [true/false]       Ignore versions with unstable semver
    -r, --respect-latest [true/false]        Ignore versions newer than dependency's "latest"
    -r, --recreate-closed [true/false]       Recreate PR even if same was previously closed
    -r, --recreate-unmergeable [true/false]  Recreate PR if existing branch is unmergeable
    -l, --log-level <level>                  Log Level

  Examples:

    $ renovate --token abc123 singapore/lint-condo
    $ renovate --ignore-unstable=false -l verbose singapore/lint-condo
    $ renovate singapore/lint-condo singapore/package-test
```

## Deployment

See [deployment docs](docs/deploment.md) for details.

## Design Decisions

See [design decisions doc](docs/design-decisions.md) for details.
