# Bot comparison

This page explains the key differences between Renovate and Dependabot.

This is not meant to be a “versus” or anti-Dependabot page, and it's not marketing.
It should be as objective as possible, to help users decide which tool is best for them.

If you see anything wrong on this page, please let us know by creating a [Discussion](https://github.com/renovatebot/renovate/discussions), or edit this page with a PR.

## Table of features

| Feature                                   | Renovate                                                                                                                       | Dependabot                                                                                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dependency Dashboard                      | Yes                                                                                                                            | No                                                                                                                                                                           |
| Grouped updates                           | Yes, use community-provided groups, or create your own                                                                         | Yes, create [`groups`](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file#groups) manually     |
| Upgrades common monorepo packages at once | Yes                                                                                                                            | No                                                                                                                                                                           |
| Officially supported platforms            | GitHub, GitLab, Bitbucket, Azure, Gitea, see [full list](https://docs.renovatebot.com/#supported-platforms)                    | GitHub only                                                                                                                                                                  |
| Supported languages                       | [List for Renovate](https://docs.renovatebot.com/modules/manager/)                                                             | [List for Dependabot](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/about-dependabot-version-updates#supported-repositories-and-ecosystems) |
| Show changelogs                           | Yes                                                                                                                            | Yes                                                                                                                                                                          |
| Compatibility score badges                | Four badges showing: Age, Adoption, Passing, Confidence                                                                        | One badge with overall compatibility score                                                                                                                                   |
| Built-in to GitHub                        | No, requires app or self-hosting                                                                                               | Yes                                                                                                                                                                          |
| Scheduling                                | By default, Renovate runs as often as it is allowed to, read [Renovate scheduling](./key-concepts/scheduling.md) to learn more | Yes: `daily`, `weekly`, `monthly`                                                                                                                                            |
| License                                   | [GNU Affero General Public License](https://github.com/renovatebot/renovate/blob/main/license)                                 | [The Prosperity Public License 2.0.0](https://github.com/dependabot/dependabot-core/blob/main/LICENSE)                                                                       |
| Programming language of project           | TypeScript                                                                                                                     | Ruby                                                                                                                                                                         |
| Project pulse                             | [`renovatebot/renovate` monthly pulse](https://github.com/renovatebot/renovate/pulse/monthly)                                  | [`dependabot-core` monthly pulse](https://github.com/dependabot/dependabot-core/pulse/monthly)                                                                               |
| Contributor graph                         | [`renovatebot/renovate` contributor graph](https://github.com/renovatebot/renovate/graphs/contributors)                        | [`dependabot-core` contributor graph](https://github.com/dependabot/dependabot-core/graphs/contributors)                                                                     |

## Hosted app

This section explains the key differences when you're using the Mend Renovate app or the GitHub-native Dependabot.

If you're going to self-host a bot, read the hosted app section first anyway.
Then read the self-hosted section.

### Dependency Dashboard

One big feature of Renovate is the Dependency Dashboard, which is enabled by default.
Read the [Key concepts, Dependency Dashboard](./key-concepts/dashboard.md) page to learn more.

Dependabot does not have a similar feature.

### Grouped updates

Renovate comes with community-provided groupings of dependencies, so it will group common dependencies out-of-the-box.

With Dependabot you'll have to set your own [`groups`](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file#groups).

### Upgrades common monorepo packages at once

Renovate has a [`group:monorepos`](https://docs.renovatebot.com/presets-group/#groupmonorepos) preset, that upgrades common monorepo packages at once.

Dependabot does not update common monorepo packages at once.

### Supported platforms

Platform means the Git-hosting site or program, for example GitHub, GitLab or Azure.

Renovate works on multiple platforms, including GitHub.
Read the [list of Renovate platforms](https://docs.renovatebot.com/modules/platform/) to learn more.

The _official_ Dependabot program only works on GitHub.
If you're an advanced user, you may use the [`dependabot-core` repository](https://github.com/dependabot/dependabot-core) as a base to build your own Dependabot, which you can run on other platforms.

### Supported languages

- [Renovate's supported managers](https://docs.renovatebot.com/modules/manager/)
- [Dependabot's supported repositories and ecosystems](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/about-dependabot-version-updates#supported-repositories-and-ecosystems)

### Show changelogs

Renovate and Dependabot show changelogs in their PRs.

### Compatibility score badges

Renovate has four _Merge Confidence_ badges:

- **Age**: The age of the package
- **Adoption**: The percentage of this package's users (within Renovate) which are using this release
- **Passing**: The percentage of updates which have passing tests for this package
- **Confidence**: The confidence level for this update

Read the [Merge Confidence badges](./merge-confidence.md) page to learn more.

Dependabot shows one compatibility score badge.
This score tells you how many other repositories have passing CI tests for the proposed update.
Read the [GitHub Docs, Dependabot's compatibility scores](https://docs.github.com/en/code-security/dependabot/dependabot-security-updates/about-dependabot-security-updates#about-compatibility-scores) to learn more about Dependabot's badge.

### Built-in to GitHub vs app

Renovate needs app installation or self-hosting.

Dependabot is built-in to GitHub.

### Scheduling

Read [Renovate scheduling](./key-concepts/scheduling.md).
With Renovate you can set a schedule per package, manager, or globally.

Dependabot has four options that apply at a language level:

- [`schedule.interval`](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file#scheduleinterval)
- [`schedule.day`](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file#scheduleday)
- [`schedule.time`](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file#scheduletime)
- [`schedule.timezone`](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file#scheduletimezone)

### License

Renovate uses the [GNU Affero General Public License](https://github.com/renovatebot/renovate/blob/main/license).

Dependabot uses [The Prosperity Public License 2.0.0](https://github.com/dependabot/dependabot-core/blob/main/LICENSE).

### Programming language of project

Renovate uses TypeScript.

`dependabot-core` uses Ruby.

## Self-hosting a bot

This section explains how you can self-host each bot.

### Self-hosting Renovate

You can self-host Renovate on all [officially supported platforms](https://docs.renovatebot.com/#supported-platforms).

If you decide to self-host Renovate, start by reading the items from the [Self-hosting Renovate reading list](./reading-list.md#self-hosting-renovate).

Available [Renovate distributions](./getting-started/running.md#available-distributions):

- npm package (CLI)
- Docker images
- GitHub Action
- GitLab Runner
- Mend Renovate On-Premises
- Mend Remediate (commercial offering)
- Forking Renovate app

### Self-hosting Dependabot

You can self-host Dependabot on other platforms than GitHub.

#### `dependabot-core`

If you want to customize Dependabot, or self-host on another platform, you can use [`dependabot-core`](https://github.com/dependabot/dependabot-core).
Quote from the `dependabot-core` readme:

> It [`dependabot-core`] currently supports opening Pull Requests against repositories hosted on GitHub, Github Enterprise, Azure DevOps, GitLab, BitBucket, and AWS CodeCommit.

#### `dependabot-script`

The Dependabot team has a community-maintained collection of scripts to start self-hosting Dependabot: [`dependabot-script`](https://github.com/dependabot/dependabot-script).

#### `dependabot-gitlab/dependabot`

There's also a community-maintained Dependabot for GitLab: [`dependabot-gitlab/dependabot`](https://gitlab.com/dependabot-gitlab/dependabot).
