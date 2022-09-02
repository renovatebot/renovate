![Renovate banner](https://app.renovatebot.com/images/renovate_660_220.jpg)

# Renovate

Automated dependency updates.
Multi-platform and multi-language.

[![License: AGPL-3.0-only](https://img.shields.io/badge/license-%20%09AGPL--3.0--only-blue.svg)](https://raw.githubusercontent.com/renovatebot/renovate/main/license)
[![codecov](https://codecov.io/gh/renovatebot/renovate/branch/main/graph/badge.svg)](https://codecov.io/gh/renovatebot/renovate)
[![Renovate enabled](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovatebot.com/)
[![Build status](https://github.com/renovatebot/renovate/workflows/build/badge.svg)](https://github.com/renovatebot/renovate/actions)
![Docker Pulls](https://img.shields.io/docker/pulls/renovate/renovate?color=turquoise)

## Why Use Renovate?

- Get automated Pull Requests to update your dependencies
- Reduce noise by running Renovate on a schedule, for example:
  - on weekends
  - outside of working hours
  - each week
  - each month
- Relevant package files are discovered automatically
- Supports monorepo architectures like Lerna or Yarn workspaces with no extra configuration
- Bot behavior is customizable via configuration files (config as code)
- Use ESLint-like shared config presets for ease of use and simplifying configuration (JSON format only)
- Lock files are supported and updated in the same commit, including immediately resolving conflicts whenever PRs are merged
- Get replacement PRs to migrate from a deprecated dependency to the community suggested replacement (npm packages only)
- Open source (installable via npm/Yarn or Docker Hub) so can be self-hosted or used via GitHub App

## Supported Platforms

Renovate works on the following platforms:

- GitHub (.com and Enterprise Server)
- GitLab (.com and CE/EE)
- Bitbucket Cloud
- Bitbucket Server
- Azure DevOps
- Gitea

## Who Uses Renovate?

Renovate is widely used in the developer community:

![Renovate Matrix](https://app.renovatebot.com/images/matrix.png)

## The Renovate Approach

We believe everyone benefits from automation, whether it's a little or a lot.
This means that Renovate:

- Adapts to your workflow
- Allows you to configure its behavior
- Will autodetect settings where possible

## Using Renovate

Get started with Renovate by checking out our [tutorial](https://github.com/renovatebot/tutorial).

### GitHub

It's easiest to use the hosted Renovate app.
Install the [Renovate app](https://github.com/apps/renovate) now.

[More details on the GitHub App installation](https://docs.renovatebot.com/getting-started/installing-onboarding/).

### Azure DevOps

There are two ways to run Renovate on Azure DevOps:

- Renovate Me extension
- Custom pipeline

#### Renovate Me extension

Go to the Visual Studio Marketplace and install the [Renovate Me](https://marketplace.visualstudio.com/items?itemName=jyc.vsts-extensions-renovate-me) extension in your organization.
From there you can create a pipeline with the `RenovateMe` task.
[More details on how to configure the pipeline](https://marketplace.visualstudio.com/items?itemName=jyc.vsts-extensions-renovate-me).

**Note:** This extension is created and maintained personally by a Renovate developer/user so support requests relating to the extension itself cannot be answered directly in the main Renovate repository.

#### Custom pipeline

You can create a custom pipeline with a `yml` definition that triggers `npx renovate`.
[More details on how to configure the pipeline](https://docs.renovatebot.com/setup-azure-devops/).

### Bitbucket Cloud/Server, Gitea, GitLab

For Bitbucket Cloud, Bitbucket Server, Gitea and GitLab, use our self-hosting option.

## Configuration

Go to our [documentation website](https://docs.renovatebot.com/) to learn how to configure Renovate.
We have a [full list of configuration options](https://docs.renovatebot.com/configuration-options/).

To get help with your configuration, go to the [discussions tab in the Renovate repository](https://github.com/renovatebot/renovate/discussions) and open a new "config help" discussion post.

## Self-Hosting

To run your own instance of Renovate you have several options:

- Install the `renovate` CLI tool from npmjs, run it on a schedule (e.g. using `cron`)
- Run the `renovate/renovate` Docker Hub image (same content/versions as the CLI tool), run it on a schedule
- Run the `renovate/renovate:slim` Docker Hub image if you only use package managers that don't need third-party binaries (e.g. JavaScript, Docker, NuGet, pip)

[More details on the self-hosting development](https://github.com/renovatebot/renovate/blob/main/docs/usage/getting-started/running.md).

## Contributing

If you want to contribute to Renovate or get a local copy running, please read the instructions in [.github/contributing.md](.github/contributing.md).
To get started look at the [list of good first issues](https://github.com/renovatebot/renovate/contribute).

## Security / Disclosure

If you find any bug with Renovate that may be a security problem, then e-mail us at: [renovate-disclosure@mend.io](mailto:renovate-disclosure@mend.io).
This way we can evaluate the bug and hopefully fix it before it gets abused.
Please give us enough time to investigate the bug before you report it anywhere else.

Please do not create GitHub issues for security-related doubts or problems.
