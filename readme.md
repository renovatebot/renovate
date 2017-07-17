![Renovate banner](https://renovateapp.com/images/design/header_small.jpg)

# renovate

Keep npm dependencies up-to-date.

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/singapore/renovate/master/license)
[![codecov](https://codecov.io/gh/singapore/renovate/branch/master/graph/badge.svg)](https://codecov.io/gh/singapore/renovate)
[![Join the chat at https://gitter.im/renovate-app/Lobby](https://badges.gitter.im/renovate-app/Lobby.svg)](https://gitter.im/renovate-app/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

## Why

-   Creates or updates Pull Requests for each dependency that needs updating
-   Discovers and processes all `package.json` files in repository (supports monorepo architecture)
-   Supports multiple major versions per-dependency at once
-   Configurable via file, environment, CLI, and `package.json`
-   Supports `yarn.lock` and `package-lock.json` files
-   Supports GitHub and GitLab
-   Open source and can be self-hosted

## GitHub App

Renovate is now available as a free GitHub "App". Go to [https://github.com/apps/renovate](https://github.com/apps/renovate) to enable it now.

## Install

```
$ npm install -g renovate
```

## Authentication

You need to select a repository user for `renovate` to assume the identity of, and generate a Personal Access Token. It's recommended that you use a dedicated "bot" account for this to avoid user confusion.

You can find instructions for GitHub [here](https://help.github.com/articles/creating-an-access-token-for-command-line-use/) (select "repo" permissions)

You can find instructions for GitLab [here](https://docs.gitlab.com/ee/api/README.html#personal-access-tokens).

This token needs to be configured via file, environment variable, or CLI. See [docs/configuration.md](docs/configuration.md) for details.
The simplest way is to expose it as `GITHUB_TOKEN` or `GITLAB_TOKEN`.

## Usage

Run `renovate --help` for usage details.

Note: The first time you run `renovate` on a repository, it will not upgrade any dependencies. Instead, it will create a Pull Request (Merge Request if GitLab) called 'Configure Renovate' and commit a default `renovate.json` file to the repository. This PR can be close unmerged if the default settings are fine for you. Also, this behaviour can be disabled if you set the `onboarding` configuration option to `false` before running.

## Deployment

See [deployment docs](https://github.com/singapore/renovate/blob/master/docs/deployment.md) for details.

## Configuration

The [Configuration](https://github.com/singapore/renovate/blob/master/docs/configuration.md) and [Configuration FAQ](https://github.com/singapore/renovate/blob/master/docs/faq.md) documents should be helpful.

## Design Decisions

See [design decisions doc](https://github.com/singapore/renovate/blob/master/docs/design-decisions.md) for details.
