# Introduction

The `lib/data` folder has all our crowdsourced data files.
This readme explains what each file is used for.

## Summary

| File                  | What is the file about?                   |
| --------------------- | ----------------------------------------- |
| `monorepo.json`       | Group related packages into a single PR.  |
| `changelog-urls.json` | Tell Renovate where to find changelogs.   |
| `source-urls.json`    | Tell Renovate the source URL of packages. |

## Group related packages (`monorepo.json`)

The `monorepo.json` file has all the monorepo presets.

Monorepo presets group related packages, so they are updated with a single Renovate PR.

### Ways to group packages

There are three ways to group packages:

| Group packages                      | Method          |
| ----------------------------------- | --------------- |
| From the same source repository.    | `repoGroups`    |
| From the same organization.         | `orgGroups`     |
| Based on name patterns or prefixes. | `patternGroups` |

## Tell Renovate where to find changelogs (`changelog-urls.json`)

The `changelog-urls.json` has all the changelog information.

Renovate nearly always finds, and displays, the changelog for a package update automatically.

To find the changelog, Renovate needs the:

- Name of the package
- URL to the changelog file

Usually, the API for the package to be updated gives Renovate the correct info.
If this does not happen, for whatever reason, Renovate can not show the changelog.

You can use these config options to let Renovate find the correct changelog:

- [`changelogUrl`](https://docs.renovatebot.com/configuration-options/#changelogurl)

Read the [Renovate docs, key concepts page for changelogs](https://docs.renovatebot.com/key-concepts/changelogs/) to learn more about how Renovate fetches and displays changelogs.

## Tell Renovate where to find source urls (`source-urls.json`)

The `source-urls.json` has the information on source URL of multiple packages.

Renovate nearly always finds, and displays, the source for a package update automatically.
Usually, the API for the package to be updated gives Renovate the correct info.
If this does not happen, for whatever reason, Renovate can not link to the source of the package and might not be able to lookup changelogs.

To find the source URL, Renovate needs the:

- Name of the package
- URL to the source

To check if Renovate can find the source URLs for your package:

1. Find the datasource for your package.
1. Read the Renovate docs for the datasource.
1. Look for a table in the docs that shows if the datasource returns source URLs.

If Renovate does not find the right source URls automatically: use the [`sourceUrl` config option](https://docs.renovatebot.com/configuration-options/#sourceurl).
