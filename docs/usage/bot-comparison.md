# Bot comparison

This page explains the differences between Renovate and Dependabot.

## Table

| Name of feature | Dependabot | Renovate |
| ----------------| ---------- | -------- |
| Dependency Dashboard | No | Yes |
| Grouped updates | Yes, you create groups | Yes, use built-in groups, or create your own |
| Monorepo support | research | Yes |
| Supported platforms | GitHub only| multiple |
| Supported languages | [List for Dependabot](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/about-dependabot-version-updates#supported-repositories-and-ecosystems) | [List for Renovate](https://docs.renovatebot.com/modules/manager/) |
| Customizability | low | high |
| Show changelogs | yes | yes |
| Compatibility score badge(s) | 1 | 4 |
| Built-in to GitHub | yes | no, requires app or self-hosting |

## Dependency Dashboard

Big difference so we should highlight it.
Read the [Key concepts, Dependency Dashboard](https://docs.renovatebot.com/key-concepts/dashboard/) page to learn more.

## Grouped updates

Dependabot recently added grouped update support.
Research recent blog posts to see how it works.

## Monorepo support

Research how Dependabot handles monorepos.
Link to Dependabot docs if available.

## Supported platforms

Platform means the Git-hosting site or program, for example GitHub, GitLab or Azure.

Dependabot only works on GitHub.

Renovate works on other platforms as well.
Read the [list of Renovate platforms](https://docs.renovatebot.com/modules/platform/) to learn more.

## Supported languages

Follow these links to learn what languages and ecosystems each bot supports:

- [Renovate's supported managers](https://docs.renovatebot.com/modules/manager/)
- [GitHub Docs, Dependabot's supported repositories and ecosystems](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/about-dependabot-version-updates#supported-repositories-and-ecosystems)

## Customizability

Low for Dependabot, high for Renovate.

## Show changelogs

Renovate and Dependabot show changelogs in their PRs.

## Compatiblity score badge(s)

Dependabot shows one compatibility score badge.
This score tells you how many other repositories have passing CI tests for the proposed update.
Read the [GitHub Docs, Dependabot's compatibility scores](https://docs.github.com/en/code-security/dependabot/dependabot-security-updates/about-dependabot-security-updates#about-compatibility-scores) to learn more about Dependabot's badge.

Renovate has four _Merge Confidence_ badges:

- **Age**: The age of the package
- **Adoption**: The percentage of this package's users (within Renovate) which are using this release
- **Passing**: The percentage of updates which have passing tests for this package
- **Confidence**: The confidence level for this update

Read the [Merge Confidence badges](https://docs.renovatebot.com/merge-confidence/) page to learn more.

## Built-in to GitHub vs app

Dependabot is built-in to GitHub, Renovate needs app installation or self-hosting.
