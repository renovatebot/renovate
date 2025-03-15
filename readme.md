![Mend Renovate CLI banner](https://docs.renovatebot.com/assets/images/mend-renovate-cli-banner.jpg)

[![License: AGPL-3.0-only](https://img.shields.io/badge/license-%20%09AGPL--3.0--only-blue.svg)](https://raw.githubusercontent.com/renovatebot/renovate/main/license)
[![codecov](https://codecov.io/gh/renovatebot/renovate/branch/main/graph/badge.svg)](https://codecov.io/gh/renovatebot/renovate)
[![Renovate enabled](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovatebot.com/)
[![Build status](https://github.com/renovatebot/renovate/actions/workflows/build.yml/badge.svg)](https://github.com/renovatebot/renovate/actions/workflows/build.yml)
![Docker Pulls](https://img.shields.io/docker/pulls/renovate/renovate?color=turquoise)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/renovatebot/renovate/badge)](https://securityscorecards.dev/viewer/?uri=github.com/renovatebot/renovate)

# What is the Mend Renovate CLI?

Renovate is an automated dependency update tool.
It helps to update dependencies in your code without needing to do it manually.
When Renovate runs on your repo, it looks for references to dependencies (both public and private) and, if there are newer versions available, Renovate can create pull requests to update your versions automatically.

## Features

- Delivers update PRs directly to your repo
  - Relevant package files are discovered automatically
  - Pull Requests automatically generated in your repo
- Provides useful information to help you decide which updates to accept (age, adoption, pass rates, merge confidence)
- Highly configurable and flexible to fit in with your needs and repository standards
- Largest collection of languages and platforms (listed below)
- Connects with private repositories and package registries

### Languages

Renovate can provide updates for most popular languages, platforms, and registries including: npm, Java, Python, .NET, Scala, Ruby, Go, Docker and more.
Supports over [90 different package managers](https://docs.renovatebot.com/modules/manager/).

### Platforms

Renovate updates code repositories on the following platforms: GitHub, GitLab, Bitbucket, Azure DevOps, AWS Code Commit, Gitea, Forgejo, Gerrit (experimental)

## Ways to run Renovate

The most effective way to run Renovate is to use an automated job scheduling system that regularly runs Renovate on all enabled repositories and responds with priority to user activity.
Mend offers cloud-hosted and self-hosted solutions.
See the options below.

### Mend Renovate Community (Cloud-Hosted)

**Supports: GitHub.com, Bitbucket Cloud**

Hosted by Mend.io.
No setup is needed.
Community plan available (Free)

- GitHub Cloud: Install the [Renovate Cloud-Hosted App](https://github.com/apps/renovate) on your GitHub org, then select the repos to enable
- Bitbucket Cloud: Add the [Mend App](https://marketplace.atlassian.com/apps/1232072/mend) to your Workspace, then add the Mend Renovate user to the projects you want to enable

### Mend Renovate Community (Self-hosted)

**Supports: GitHub, GitLab, Bitbucket Data Center**

Install and run your own Renovate server.
Access internal packages.

- [Mend Renovate Community Self-Hosted](https://github.com/mend/renovate-ce-ee/tree/main/docs) (Free)
- [Mend Renovate Enterprise](https://www.mend.io/mend-renovate/) (Paid plan)

### Other ways to run Renovate

If you can’t use a pre-built job scheduling system, or want to build your own, the following options are available:

#### Run Renovate on your Pipeline

Mend provides a _**GitHub Action**_ or a _**GitLab Runner**_ to help you run Renovate as a CI pipeline job.

- GitHub Action: [renovatebot/github-action](https://github.com/renovatebot/github-action).
- GitLab Runner: [Renovate Runner project](https://gitlab.com/renovate-bot/renovate-runner/)
- AzureDevOps action: [Renovate Me extension](https://marketplace.visualstudio.com/items?itemName=jyc.vsts-extensions-renovate-me)<br>
  _Note: This extension is created and maintained personally by a Renovate developer/user. Support requests for the extension will not be answered directly in the main Renovate repository._
- Custom pipeline: You can create a custom pipeline with a **yml** definition that triggers **npx renovate**. [More details on how to configure the pipeline](https://docs.renovatebot.com/modules/platform/azure/).

#### Run Renovate CLI

There are several ways to run the Renovate CLI directly.
See docs: [Running Renovate](https://docs.renovatebot.com/getting-started/running/) for all options.

**Supports: all platforms**

## Docs

### More about Renovate

- Renovate basics
  - [Why use Renovate](https://docs.renovatebot.com/#why-use-renovate)
  - [What does it do? / How does it work?](https://docs.renovatebot.com/key-concepts/how-renovate-works/)
  - [Who is using it?](https://docs.renovatebot.com/#who-uses-renovate)
- Supported platforms and languages
  - [Supported platforms](https://docs.renovatebot.com/#supported-platforms)
  - [Supported languages / package managers](https://docs.renovatebot.com/modules/manager/)
- Advanced Renovate usage
  - [Accessing private packages](https://docs.renovatebot.com/getting-started/private-packages/)
  - [Merge Confidence data](https://docs.renovatebot.com/merge-confidence/)

### Renovate Docs

- [Renovate Configuration](https://docs.renovatebot.com/configuration-options/)
- [Mend Renovate Self-Hosted Docs](https://github.com/mend/renovate-ce-ee/tree/main/docs)

### Comparisons

- [Different ways to run Renovate](https://www.mend.io/renovate/)
- [Renovate vs Dependabot](https://docs.renovatebot.com/bot-comparison/)

## Get involved

### Issues and Discussions

Please open a Discussion to get help, suggest a new feature, or to report a bug.
We only want maintainers to open Issues.

- [GitHub Discussions for Renovate](https://github.com/renovatebot/renovate/discussions)

### Contributing

To contribute to Renovate, or run a local copy, please read the contributing guidelines.

- [Guidelines for Contributing](https://github.com/renovatebot/renovate/blob/main/.github/contributing.md)
- Items that need contribution: [good first issues](https://github.com/renovatebot/renovate/contribute)

### Contact and Social Media

The Renovate project is proudly supported and actively maintained by Mend.io.

- Contact [Mend.io](https://www.mend.io/) for commercial support questions.

Follow us on:

- Twitter: [x.com/mend_io](https://x.com/mend_io)
- LinkedIn: [linkedin.com/company/mend-io](https://linkedin.com/company/mend-io)

## Security / Disclosure

If you find any bug with Renovate that may be a security problem, then e-mail us at: [renovate-disclosure@mend.io](mailto:renovate-disclosure@mend.io).
This way we can evaluate the bug and hopefully fix it before it gets abused.
Please give us enough time to investigate the bug before you report it anywhere else.

Please do not create GitHub issues for security-related doubts or problems.
