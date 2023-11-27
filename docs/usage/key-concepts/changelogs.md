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

Renovate can fetch changelogs from these platforms:

- List item 1
- List item 2

### Running Renovate on a non-GitHub platform

Read [Running Renovate, GitHub.com token for changelogs](../getting-started/running.md#githubcom-token-for-changelogs).

## Troubleshooting missing changelogs

Follow these steps to see why Renovate can't find a changelog:

1. Step one
1. Step two
1. Step three

## Advice for package maintainers

This section is for package maintainers that want to make sure Renovate can see their changelogs.

### npm package maintainers

I remember that Renovate needs a repository source url in the `package.json`, or at least some field in the `package.json` must be filled out.
We helped Docusaurus a while back to get the changelogs visible, but they had a complicated monorepo setup.

### yarn package maintainers

I suspect Yarn needs a similar field in the `package.json` as the npm package manager.

### maven package maintainers

Read [`maven` datasource, making your changelogs fetchable](https://docs.renovatebot.com/modules/datasource/maven/#making-your-changelogs-fetchable).

### Docker image maintainers

Read the [Docker datasource](https://docs.renovatebot.com/modules/datasource/docker/) docs.

### Rust packages

Explain how to get Rust changelogs here.

### Nuget packages

Explain how to get Nuget changelogs here.

### Go packages

Explain how to get Go changelogs here.

### Ruby packages

Explain how to get Ruby (gem) changelogs here.

## What about that `changelog.json` file?

Renovate can apparently read `changelog.json` files, I don't know how that works.

## Anything I'm forgetting about

Suggest anything that I'm forgetting here.
