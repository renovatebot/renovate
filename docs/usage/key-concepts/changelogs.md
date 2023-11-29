---
title: Renovate and changelogs
description: Learn how Renovate fetches changelogs
---

This page explains how Renovate fetches changelogs, when it can display them, and more.

## How Renovate sees changelogs

Renovate "sees" changelogs by:

1. List step one that Renovate takes
1. List step two
1. List step three

## Changelogs for private packages

- [Private packages, looking up changelogs](../getting-started/private-packages.md#looking-up-changelogs)

## Relevant configuration options

- [`fetchChangelogs`](../configuration-options.md#fetchchangelogs)
- [`customChangelogUrl`](../configuration-options.md#customchangelogurl)

## Platforms that Renovate can fetch changelogs from

See the list of platforms in the [`fetchChangelogs` config option docs](../configuration-options.md#fetchchangelogs).

### Running Renovate on a non-GitHub platform

When you run Renovate on a non-GitHub platform, you must give Renovate a special token.
Read [Running Renovate, GitHub.com token for changelogs](../getting-started/running.md#githubcom-token-for-changelogs) to learn more.

## Troubleshooting missing changelogs

Follow these steps to find out why Renovate does not find a changelog:

1. Step one
1. Step two
1. Step three

If none of this helps, search the Renovate issues and discussions to see if this is a known problem.

## Advice for package maintainers

This section is for package maintainers that want to make sure Renovate can see their changelogs.

### Let Renovate understand your versioning and changelogs

In general, Renovate can understand your versions and changelogs best when you:

- Use SemVer versioning, so `major.minor.patch`
- Use the [`semantic-release` bot](https://github.com/semantic-release/semantic-release) to automate the release process
- Anything else I'm forgetting to list here

### npm package maintainers

As maintainer, make sure the `package.json` has a filled in `repository` field, read the [npm Docs, configuring npm `repository` field](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#repository) to learn more.
If your repository uses the monorepo pattern make sure _each_ `package.json` file has a `repository` field.

### yarn package maintainers

I suspect Yarn needs a similar field like `repository` in the `package.json` as for the npm package manager.
Maybe Yarn even uses the same field...

### maven package maintainers

Read [`maven` datasource, making your changelogs fetchable](https://docs.renovatebot.com/modules/datasource/maven/#making-your-changelogs-fetchable).

### Docker image maintainers

Read the [Docker datasource](https://docs.renovatebot.com/modules/datasource/docker/) docs.

### Rust package maintainers

Explain how to get Rust changelogs here.

### Nuget package maintainers

Explain how to get Nuget changelogs here.

See [Renovate issue #14128 about using NuGet's changelogs](https://github.com/renovatebot/renovate/issues/14128).

### Go package maintainers

Explain how to get Go changelogs here.

### Ruby package maintainers

Explain how to get Ruby (gem) changelogs here.

## What about that `changelog.json` file?

Renovate can apparently read `changelog.json` files, I don't know how that works.

## Anything I'm forgetting about

Suggest anything that I'm forgetting here.
