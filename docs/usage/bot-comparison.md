# Bot comparison

This page explains the key differences between Renovate and Dependabot, to help you choose a bot.
We're trying to be as objective as possible, so this is not a "versus" or anti-Dependabot page.

If you see anything wrong on this page, please let us know by creating a [Discussion](https://github.com/renovatebot/renovate/discussions), or edit this page with a PR.

## Table of features

| Feature                                   | Renovate                                                                                                                       | Dependabot                                                                                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dependency Dashboard                      | Yes                                                                                                                            | No                                                                                                                                                                           |
| Grouped updates                           | Yes, use community-provided groups, or create your own                                                                         | Yes, create [`groups`](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file#groups) manually     |
| Upgrades common monorepo packages at once | Yes                                                                                                                            | No                                                                                                                                                                           |
| Officially supported platforms            | GitHub, GitLab, Bitbucket, Azure, Gitea, see [full list](./index.md#supported-platforms)                                       | GitHub only                                                                                                                                                                  |
| Supported languages                       | [List for Renovate](./modules/manager/index.md)                                                                                | [List for Dependabot](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/about-dependabot-version-updates#supported-repositories-and-ecosystems) |
| Show changelogs                           | Yes                                                                                                                            | Yes                                                                                                                                                                          |
| Compatibility score badges                | Four badges showing: Age, Adoption, Passing, Confidence                                                                        | One badge with overall compatibility score                                                                                                                                   |
| Built-in to GitHub                        | No, requires app or self-hosting                                                                                               | Yes                                                                                                                                                                          |
| Scheduling                                | By default, Renovate runs as often as it is allowed to, read [Renovate scheduling](./key-concepts/scheduling.md) to learn more | Yes: `daily`, `weekly`, `monthly`                                                                                                                                            |
| License                                   | [GNU Affero General Public License](https://github.com/renovatebot/renovate/blob/main/license)                                 | [MIT License](https://github.com/dependabot/dependabot-core/blob/main/LICENSE)                                                                                               |
| Programming language of project           | TypeScript                                                                                                                     | Ruby                                                                                                                                                                         |
| Project pulse                             | [`renovatebot/renovate` monthly pulse](https://github.com/renovatebot/renovate/pulse/monthly)                                  | [`dependabot-core` monthly pulse](https://github.com/dependabot/dependabot-core/pulse/monthly)                                                                               |
| Contributor graph                         | [`renovatebot/renovate` contributor graph](https://github.com/renovatebot/renovate/graphs/contributors)                        | [`dependabot-core` contributor graph](https://github.com/dependabot/dependabot-core/graphs/contributors)                                                                     |

## Hosted app

This section explains the key differences between the Mend Renovate app and the GitHub-native Dependabot.

Even if you're going to self-host a bot, read the hosted app section first, because many features and concepts are similar.
Then read the self-hosted section.

### Dependency Dashboard

One big feature of Renovate is the Dependency Dashboard, which is enabled by default.
Read the [Key concepts, Dependency Dashboard](./key-concepts/dashboard.md) page to learn more.

Dependabot does not have a similar feature.

### Grouped updates

Renovate comes with community-provided groupings of dependencies.
So Renovate groups common dependencies into a single PR, out-of-the-box.

Dependabot can group dependencies into a single PR too, but you must set your own [`groups`](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file#groups) first.

### Upgrades common monorepo packages at once

Renovate has a [`group:monorepos`](./presets-group.md#groupmonorepos) preset, that upgrades common monorepo packages in a single PR.

Dependabot does not update common monorepo packages in a single PR.

### Supported platforms

Platform means the Git-hosting site or program, for example GitHub, GitLab or Azure.

Renovate works on multiple platforms, including GitHub.
Read the [list of Renovate platforms](./modules/platform/index.md) to learn more.

The _official_ Dependabot program only works on GitHub.
If you're an advanced user, you may use the [`dependabot-core` repository](https://github.com/dependabot/dependabot-core) as a base to build your own Dependabot, which you can run on other platforms.

### Supported languages

- [Renovate's supported managers](./modules/manager/index.md)
- [Dependabot's supported repositories and ecosystems](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/about-dependabot-version-updates#supported-repositories-and-ecosystems)

### Show changelogs

| Feature                               | Renovate                     | Dependabot                      |
| ------------------------------------- | ---------------------------- | ------------------------------- |
| Link to GitHub release                | Yes, to specific release tag | Yes, to "releases landing page" |
| Link to GitHub's comparing changes UI | Yes                          | Yes                             |
| Release notes                         | Yes                          | Yes                             |
| Links to issues                       | Yes                          | Yes                             |
| Upstream `CHANGELOG` file             | No                           | Yes                             |
| Recent commits                        | No                           | Yes                             |
| Link to individual commits            | No                           | Yes                             |

### Compatibility score badges

Renovate shows four _Merge Confidence_ badges in its PRs:

- **Age**: The age of the package
- **Adoption**: The percentage of this package's users (within Renovate) which are using this release
- **Passing**: The percentage of updates which have passing tests for this package
- **Confidence**: The confidence level for this update

Read the [Merge Confidence badges](./merge-confidence.md) page to learn more.

Dependabot shows one compatibility score badge in its PRs.
This score tells you how many other repositories have passing CI tests for the proposed update.
Read the [GitHub Docs, Dependabot's compatibility scores](https://docs.github.com/en/code-security/dependabot/dependabot-security-updates/about-dependabot-security-updates#about-compatibility-scores) to learn more about Dependabot's badge.

### Built-in to GitHub vs app

Renovate needs app installation or self-hosting.

Dependabot is built-in to GitHub.

### Scheduling

You can set a schedule for Renovate, per dependency, manager, or even a global schedule.
Read [Renovate scheduling](./key-concepts/scheduling.md) to learn more.

Dependabot has four options that apply at a language level:

- [`schedule.interval`](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file#scheduleinterval)
- [`schedule.day`](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file#scheduleday)
- [`schedule.time`](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file#scheduletime)
- [`schedule.timezone`](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file#scheduletimezone)

### License

Renovate uses the [GNU Affero General Public License](https://github.com/renovatebot/renovate/blob/main/license).

Dependabot uses the [MIT License](https://github.com/dependabot/dependabot-core/blob/main/LICENSE).

Neither license is relevant to the end user though if consuming through an App/SaaS.

### Programming language of project

Renovate uses TypeScript.

`dependabot-core` uses Ruby.

## Self-hosting a bot

This section explains how to self-host each bot.

### Self-hosting Renovate

You can self-host Renovate on all [officially supported platforms](./index.md#supported-platforms).

If you decide to self-host Renovate, read the items from the [Self-hosting Renovate reading list](./reading-list.md#self-hosting-renovate).

Available [Renovate distributions](./getting-started/running.md#available-distributions):

- npm package (CLI)
- Docker images
- GitHub Action
- GitLab Runner
- Mend Renovate On-Premises
- Mend Remediate (commercial offering)
- Forking Renovate app

### Self-hosting Dependabot

You can self-host Dependabot on other platforms than GitHub but none are officially supported.

#### As a GitHub Actions workflow on GitHub

You can run Dependabot as a GitHub Actions workflow on hosted and self-hosted runners.
Learn more by reading the:

- [GitHub Blog, Dependabot on GitHub Actions and self-hosted runners is now generally available](https://github.blog/2024-05-02-dependabot-on-github-actions-and-self-hosted-runners-is-now-generally-available/)
- [GitHub Docs, About Dependabot on GitHub Actions runners](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/about-dependabot-on-github-actions-runners)

#### `dependabot-core`

If you want to customize Dependabot, or self-host on another platform, you can use [`dependabot-core`](https://github.com/dependabot/dependabot-core).
Quote from the `dependabot-core` readme:

> It [`dependabot-core`] currently supports opening Pull Requests against repositories hosted on GitHub, Github Enterprise, Azure DevOps, GitLab, BitBucket, and AWS CodeCommit.

#### `dependabot-script`

The Dependabot team has a community-maintained collection of scripts to start self-hosting Dependabot: [`dependabot-script`](https://github.com/dependabot/dependabot-script) but the repository has included a message warning that the scripts are broken since March 2023.

#### `dependabot-gitlab/dependabot`

There's also a community-maintained Dependabot for GitLab: [`dependabot-gitlab/dependabot`](https://gitlab.com/dependabot-gitlab/dependabot).
