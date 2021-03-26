![Renovate banner](https://app.renovatebot.com/images/renovate_660_220.jpg)

# Renovate

Automated dependency updates.
Multi-platform and multi-language.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://raw.githubusercontent.com/renovatebot/renovate/master/license)
[![codecov](https://codecov.io/gh/renovatebot/renovate/branch/master/graph/badge.svg)](https://codecov.io/gh/renovatebot/renovate)
[![Renovate enabled](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovatebot.com/)
[![Build status](https://github.com/renovatebot/renovate/workflows/build/badge.svg)](https://github.com/renovatebot/renovate/actions)

## Why Use Renovate?

- Receive automated Pull Requests whenever dependencies need updating
- Define schedules to avoid unnecessary noise in projects (e.g. for weekends or outside of working hours, or weekly updates, etc.)
- Relevant package files are discovered automatically (e.g. supports monorepo architecture such as Lerna or Yarn workspaces without further configuration)
- Bot behavior is extremely customizable via configuration files (config as code)
- Use ESLint-like shared config presets for ease of use and simplifying configuration
- Lock files are natively supported and updated in the same commit, including immediately resolving conflicts whenever PRs are merged
- Supports GitHub (.com and Enterprise), GitLab (.com and CE/EE), Bitbucket Cloud, Bitbucket Server, Azure DevOps and Gitea.
- Open source (installable via npm/Yarn or Docker Hub) so can be self-hosted or used via GitHub App

## Who Uses Renovate?

Renovate was released in 2017 and already is widely used in the developer community, including:

![Renovate Matrix](https://renovatebot.com/images/matrix.png)

## The Renovate Approach

- We believe everyone benefits from automation, whether it's a little or a lot
- Renovate should not cause you to change your workflow against your wishes, instead it should be adaptable to your existing workflow
- All behavior should be configurable, down to a ridiculous level if necessary
- Autodetect settings wherever possible (to minimize configuration) but always allow overrides

## Using Renovate

The easiest way to use Renovate if you are hosted on GitHub.com is to install the hosted Renovate app.
On Azure DevOps you can install Renovate as an extension from the marketplace.

For GitHub, go to [https://github.com/apps/renovate](https://github.com/apps/renovate) to install it now.
[More details on the GitHub App installation](https://docs.renovatebot.com/install-github-app/).

For Azure DevOps, visit the Visual Studio Marketplace and install the [Renovate Me](https://marketplace.visualstudio.com/items?itemName=jyc.vsts-extensions-renovate-me) extension in your organization.
From there you can create a pipeline with the `RenovateMe` task.
[More details on how to configure the pipeline](https://marketplace.visualstudio.com/items?itemName=jyc.vsts-extensions-renovate-me).
Note: This extension is created and maintained personally by a Renovate developer/user so support requests relating to the extension itself cannot be answered directly in the main Renovate repository.
Alternatively, you can create a custom pipeline with a `yml` definition that will trigger `npx renovate`.
[More details on how to configure the pipeline](https://docs.renovatebot.com/setup-azure-devops/).

For Bitbucket Cloud, Bitbucket Server, Gitea and GitLab, use our self-hosting option.

## Configuration

Visit <https://docs.renovatebot.com/> for documentation, and in particular <https://docs.renovatebot.com/configuration-options/> for a list of configuration options.

To get help and/or a review for your config, go to the [discussions tab in the Renovate repository](https://github.com/renovatebot/renovate/discussions) and open a new "config help" discussion post.

## Self-Hosting

If you are not on github.com or gitlab.com, or you prefer to run your own instance of Renovate then you have several options:

- Install the `renovate` CLI tool from npmjs, run it on a schedule (e.g. using cron)
- Run the `renovate/renovate` Docker Hub image (same content/versions as the CLI tool), run it on a schedule
- Run the `renovate/renovate:slim` Docker Hub image if you only use package managers that don't need third party binaries (e.g. JS, Docker, Nuget, pip)

[More details on the self-hosting development](https://github.com/renovatebot/renovate/blob/master/docs/usage/self-hosting.md).

## Contributing

If you would like to contribute to Renovate or get a local copy running for some other reason, please see the instructions in [.github/contributing.md](.github/contributing.md).

## Security / Disclosure

If you discover any important bug with Renovate that may pose a security problem, please disclose it confidentially to renovate-disclosure@whitesourcesoftware.com first, so that it can be assessed and hopefully fixed prior to being exploited.
Please do not raise GitHub issues for security-related doubts or problems.
