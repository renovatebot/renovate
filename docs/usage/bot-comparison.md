# Bot comparison

This page explains the key differences between Renovate and Dependabot.

This is not meant to be a “versus” or anti-Dependabot page, and it's not marketing.
It should be as objective as possible, to help users decide which tool is best for them.

If you see anything wrong on this page, please let us know by creating a [Discussion](https://github.com/renovatebot/renovate/discussions), or edit this page with a PR.

## Table

| Name of feature            | Dependabot                                                                                                                                                                   | Renovate                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Dependency Dashboard       | No                                                                                                                                                                           | Yes                                                                |
| Grouped updates            | Yes, create [`groups`](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file#groups) manually     | Yes, use community-provided groups, or create your own             |
| Monorepo support           | unknown                                                                                                                                                                      | Yes                                                                |
| Supported platforms        | GitHub only                                                                                                                                                                  | multiple                                                           |
| Supported languages        | [List for Dependabot](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/about-dependabot-version-updates#supported-repositories-and-ecosystems) | [List for Renovate](https://docs.renovatebot.com/modules/manager/) |
| Customizability            | low                                                                                                                                                                          | high                                                               |
| Show changelogs            | yes                                                                                                                                                                          | yes                                                                |
| Compatibility score badges | 1                                                                                                                                                                            | 4                                                                  |
| Built-in to GitHub         | yes                                                                                                                                                                          | no, requires app or self-hosting                                   |
| Schedule interval          | yes: `daily`, `weekly`, `monthly`                                                                                                                                            | yes: custom                                                        |

## Dependency Dashboard

One big feature of Renovate is the Dependency Dashboard, which is enabled by default.
Read the [Key concepts, Dependency Dashboard](https://docs.renovatebot.com/key-concepts/dashboard/) page to learn more.

## Grouped updates

Renovate comes with community-provided groupings of dependencies, so it will group common dependencies out-of-the-box.
With Dependabot you'll have to set your own [`groups`](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file#groups).

## Monorepo support

Renovate has a [`group:monorepos`](https://docs.renovatebot.com/presets-group/#groupmonorepos) preset, that groups dependencies from monorepos.

I don't know if Dependabot supports monorepos.

## Supported platforms

Platform means the Git-hosting site or program, for example GitHub, GitLab or Azure.

Dependabot only works on GitHub.

Renovate works on multiple platforms, including GitHub.
Read the [list of Renovate platforms](https://docs.renovatebot.com/modules/platform/) to learn more.

## Supported languages

- [Renovate's supported managers](https://docs.renovatebot.com/modules/manager/)
- [Dependabot's supported repositories and ecosystems](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/about-dependabot-version-updates#supported-repositories-and-ecosystems)

## Customizability

Both Renovate and Dependabot come with good default settings.

Renovate gives you more control over _when_ and _how_ you'll get the updates.
Renovate gives you tools to reduce the "update noise", read our [Noise reduction](https://docs.renovatebot.com/noise-reduction/) page to learn more.

## Show changelogs

Renovate and Dependabot show changelogs in their PRs.

## Compatiblity score badges

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
