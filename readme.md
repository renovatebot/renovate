# renovate

> Keep npm dependencies up-to-date

##  Why

- Creates or updates Pull Requests for each dependency that needs updating
- Supports multiple `package.json` files per repository
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

## Usage (CLI)

```
$ renovate --help

  Usage: renovate [options] [repositories...]

  Options:

    -h, --help                  output usage information
    -d, --dep-types <list>      List of dependency types
    -i, --ignore-deps <list>    List of dependencies to ignore
    -b, --labels <list>         List of labels to apply
    -l, --log-level <level>     Log Level
    -p, --package-files <list>  List of package.json file names
    -r, --recreate-prs          Recreate PRs if previously closed
    -t, --token <token>         GitHub Auth Token

  Examples:

    $ renovate --token abc123 singapore/lint-condo
    $ renovate --token abc123 -l verbose singapore/lint-condo
    $ renovate --token abc123 singapore/lint-condo singapore/package-test
```
