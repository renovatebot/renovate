---
title: Renovate and changelogs
description: Learn how Renovate fetches changelogs
---

This page explains how Renovate fetches changelogs, when it can display them, and more.

## How Renovate detects changelogs

Renovate detects and populates changelogs by:

1. Identifying a source URL from the datasource response for a package, and saving that internally as `sourceUrl` if found
1. Checking if Renovate's internal [_sourceUrl_ data](https://github.com/renovatebot/renovate/blob/main/lib/data/source-urls.json) for the package includes a source URL
1. Looking up the source URL, if it resides on a supported platform (e.g. GitHub)
1. Checking for both "Releases" metadata in the repository and any commonly known "changelog" file names
1. Filtering the found releases to only include those versions being updated by the current PR
1. Formatting and embedding the results into the PR body

## Changelogs for private packages

For private packages, the algorithm is mostly the same as described above, with the additional considerations:

- Renovate must be able to access the private package in the first place
- The private registry must include the source URL in its response
- Renovate must be able to detect and authenticate with whatever private repository corresponds to the source URL

For more details, see [Private packages, looking up changelogs](../getting-started/private-packages.md#looking-up-changelogs).

## Relevant configuration options

### [`fetchChangelogs`](../configuration-options.md#fetchchangelogs)

Set to `off` if changelog fetching is causing a problem.

Set to `branch` if you have an advanced use case where you're embedding changelogs in the Git commit itself, we don't recommend this due to its potential size.

### [`changelogUrl`](../configuration-options.md#changelogurl)

This doesn't help with _fetching_ the changelogs, but if you configure it then Renovate will include a link to this URL in the PR body, so users can click through to read the changelog.

## Platforms that Renovate can fetch changelogs from

See the list of platforms in the [`fetchChangelogs` config option docs](../configuration-options.md#fetchchangelogs).

### Running Renovate on a non-GitHub platform

Most Open Source packages are hosted on github.com, which means most changelogs are hosted there too.
Fetching changelogs from github.com requires a GitHub token because GitHub blocks unauthenticated GraphQL API use.

This means that if you run Renovate on self-hosted GitHub Enterprise Server, or any non-GitHub platform which Renovate supports, then you need to configure a github.com Personal Access Token in Renovate in order to fetch changelogs.

Read [Running Renovate, GitHub.com token for changelogs](../getting-started/running.md#githubcom-token-for-changelogs) to learn more.

## Troubleshooting missing changelogs

Follow these steps to find out why Renovate does not find a changelog:

1. The datasource for this package does not support sourceUrls.
   - If the registry fundamentally does not provide this data, then the only possibility is for it to be manually populated through PRs to Renovate's source code
   - If the registry provides source URLs in its response but Renovate does not understand the required fields, then raise a feature request with examples, or better yet a Pull Request to implement support for the source URL parsing/mapping yourself
   - Sometimes self-hosted versions of registries don't include the full metadata compared to what the public registries do
1. The package was published without source URL information being included.
   - For example, occasionally `npm` packages don't have `repository` fields included
   - For example, Docker images regularly do not have the required `LABEL` entry
1. Renovate cannot access the source repository
   - This is typically a concern for private repositories only
   - Check if the token Renovate uses has access rights to the repository you need it to access
1. Renovate cannot detect the file names or release name convention within the repository
   - In this case an enhancement to Renovate might be needed to better detect the releases/formats, assuming the package/repository has a reasonable convention to follow
1. Renovate cannot detect the release version in the changelog file
   - Ensure the changelog header for the section contains the version being released, or in the case of a monorepo where this may not be the case, ensure the body has a line that contains both the package name and the version.
   - Otherwise an enhancement to Renovate might be needed to better detect the versions, assuming the package/repository has a reasonable convention to follow

If none of this helps, search the Renovate issues and discussions to see if this is a known problem.

## Advice for package maintainers

This section is for package maintainers that want to make sure Renovate can see their changelogs.

There isn't much information to add other than what's already written above.

Make sure that you have the required source URL in your package metadata, not just in your repository but also in the final data which the registry returns.
For example, we have seen cases where the `repository` field in npm's `package.json` is populated correctly in the repository, but stripped out as part of the publishing process.

### Let Renovate understand your versioning and changelogs

In general, Renovate can understand your versions and changelogs best when you:

- Use SemVer versioning, so `major.minor.patch`
- Use the [`semantic-release` bot](https://github.com/semantic-release/semantic-release) to automate the release process

Try to avoid things like:

- Stripping out the trailing `.0` unnecessarily (e.g. having a package `3.1.0` on a registry but using only `3.1` in your changelogs)
- Using "Release names" in a way which makes the actual version hard to discern (e.g. instead of `3.0.0` you title your release notes `Big news! v3 is here`

### npm package maintainers

As maintainer, make sure the `package.json` has a filled in `repository` field, read the [npm Docs, configuring npm `repository` field](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#repository) to learn more.
If your repository uses the monorepo pattern make sure _each_ `package.json` file has a `repository` field.

### maven package maintainers

Read [`maven` datasource, making your changelogs fetchable](../modules/datasource/maven/index.md#making-your-changelogs-fetchable).

### Docker image maintainers

Read the [Docker datasource](../modules/datasource/docker/index.md) docs.

### NuGet package maintainers

See [Renovate issue #14128 about using NuGet's changelogs](https://github.com/renovatebot/renovate/issues/14128).
