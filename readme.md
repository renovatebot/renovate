# renovate

> Keep npm dependencies up-to-date

##  Why

- Creates or updates Pull Requests for each dependency that needs updating
- Discovers and processes all `package.json` files in repository (supports monorepo architecture)
- Supports multiple major versions per-dependency at once
- Configurable via file, environment, CLI, and `package.json`
- Supports `yarn.lock` files
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
```

Note: The first time you run `renovate` on a repository, it will not upgrade any dependencies. Instead, it will create a PR called 'Configure Renovate' and commit a default `renovate.json` file to the repository. This PR can be close unmerged if the default settings are fine for you. Also, this behaviour can be disabled if you first disable the `onboarding` setting before running.

## Deployment

See [deployment docs](docs/deployment.md) for details.

## Design Decisions

See [design decisions doc](docs/design-decisions.md) for details.
