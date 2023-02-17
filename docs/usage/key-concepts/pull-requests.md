---
title: Pull requests
description: Learn about Renovate pull requests
---

This page describes how Renovate pull requests work.

## How Renovate finds existing PRs

Renovate does not keep any kind of database/state of its own about open or closed Pull Requests.
Instead, it uses the code platform's APIs to search and find such PRs.

Locating of existing PRs - whether open or closed - is done by matching both the branch name (e.g. `renovate/lodash-4.x`) and Pull Request title (e.g. `Update lodash to v4.17.21`).

In cases like the above, there is typically at most one existing PR with the desired branch + title combination.
When grouping is enabled by users, and PRs have titles like "All non-major updates", then there may be multiple past PRs which match.

## Normal PRs

As described above, Renovate PRs normally have some uniqueness in their title relating to the version in the upgrade.
In such cases, if a user closes such a PR, it can be inferred that they don't want to see it again in future.
For example, they wish to ignore `lodash@4.17.21`.

In such cases, new PRs won't be created until the branch+title uniqueness exists again, such as if there is a `lodash@4.17.22`.

Similarly in the case of major updates (such as "Update lodash to v4") then it can be inferred that the user wishes to ignore all of v4 of `lodash`, even when newer v4 versions are available.

## Immortal PRs

Some Renovate pull requests have a section like this:

> 👻 **Immortal:** This PR will be recreated if closed unmerged. Get [config help](https://github.com/renovatebot/renovate/discussions) if that's undesired.

An **immortal** PR keeps popping up again after you close it.

This document explains why we have immortal PRs, and how you can fix them.

### Why we have immortal PRs

First off, we don't have immortal PRs for some philosphical reason like: "don't ignore this update, it's good for you!".
We just have no way to ignore some PRs after they're closed.

#### Branch name and PR title are cache keys

Renovate uses the branch name and PR title like a cache key.
If the same key exists _and_ the PR was closed, then we ignore the PR.

##### Cache keys can cause problems

Let's say you have an "All non-major updates" PR.
If you close the PR, and Renovate ignores it based on the PR title, then you would never get a non-major update again.

#### Only unique version PRs can be ignored

Renovate can only ignore PRs if they have a unique version, like "to v16.1.2" or "to v16" in the title.

#### Grouped updates with different versions

The problem comes when there are groups of updates which have different versions.
Then the update becomes "Update react (major)", which is not safely ignorable, instead of "Update react to v16".

### Future plans for immortal PRs

In the future we may embed metadata in each PR identifying the exact files and packages + versions that PR contains.
Then we could allow such PRs to be closed/ignored but then as soon as there's any chance to files/packages/versions being updated then we'd be cached busted and create a new PR.
If you regularly wish to close immortal PRs, it's an indication that you may be grouping too widely.

### How to fix immortal PRs

Avoid grouping dependencies together which have different versions, or which you have a high chance of wanting to ignore.

#### Major updates require Dependency Dashboard approval

Avoid grouping major upgrades together unless they are related dependencies.
Instead, set `"dependencyDashboardApproval": true` for major updates so that you have control about when they are created.

## Ignoring PRs

To ignore a PR you just close it unmerged.

<!-- prettier-ignore -->
!!! note
    Renovate will re-create any PRs that is marked "immortal".
    What this means is that any immortal PR you close, will pop up again the next time Renovate runs.
    To ignore immortal PRs, follow the advice in the [How to fix immortal PRs](#how-to-fix-immortal-prs) section.
