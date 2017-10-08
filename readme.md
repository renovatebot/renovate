![Renovate banner](https://renovateapp.com/images/design/header_small.jpg)

# renovate

Keep dependencies up-to-date.

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/singapore/renovate/master/license)
[![codecov](https://codecov.io/gh/singapore/renovate/branch/master/graph/badge.svg)](https://codecov.io/gh/singapore/renovate)
[![Join the chat at https://gitter.im/renovate-app/Lobby](https://badges.gitter.im/renovate-app/Lobby.svg)](https://gitter.im/renovate-app/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![David](https://david-dm.org/singapore/renovate.svg)](https://david-dm.org/singapore/renovate)
[![Renovate enabled](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovateapp.com/)

## Why

-   Creates or updates Pull Requests for each dependency that needs updating
-   Discovers and processes all `package.json` files in repository (supports monorepo architecture including yarn workspaces)
-   Supports multiple major versions per-dependency at once
-   Configurable via file, environment, CLI, and `package.json`
-   Supports eslint-like preset configs for ease of use
-   Updates `yarn.lock` and `package-lock.json` files natively
-   Supports GitHub and GitLab
-   Open source and can be self-hosted or used via GitHub App

## Configuration Help

If you would like help on your Renovate configuration, or simply get someone to review it, we have created a config-help repository https://github.com/renovateapp/config-help/issues where you can post an issue with your config.

## GitHub App

Renovate is now available as a free GitHub "App". Go to [https://github.com/apps/renovate](https://github.com/apps/renovate) to enable it now.

## Install

```
$ npm install -g renovate
```

## Authentication

You need to select a repository user for `renovate` to assume the identity of, and generate a Personal Access Token. It's strongly recommended that you use a dedicated "bot" account for this to avoid user confusion and to avoid the Renovate bot mistaking changes you have made or PRs you have raised for its own.

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

You can also raise an issue in https://github.com/renovateapp/config-help if you'd like to get your config reviewed or ask any questions.

## Design Decisions

See [design decisions doc](https://github.com/singapore/renovate/blob/master/docs/design-decisions.md) for details.
