---
title: Pull requests
description: Learn about Renovate pull requests
---

This page describes how Renovate pull requests work.

## How Renovate finds existing PRs

Renovate does not need to maintain any database/state about open or closed Pull Requests.
Instead, it uses the code platform's APIs to search and find such PRs.

Renovate finds existing PRs (open or closed) by matching both:

- the branch name, for example: `renovate/lodash-4.x`,
- _and_ the Pull Request title, for example: `Update lodash to v4.17.21`

In cases like the above, there is typically one existing PR with a matching branch name and PR title.
But if you group PRs and use titles like "All non-major updates", then multiple past PRs may match.

## Normal PRs

As explained above, Renovate PRs normally have some "uniqueness" in their title relating to the version in the upgrade.
When you close a "unique" PR, Renovate assumes you don't want to see that PR again in future, for example:

1. You ignored `lodash@4.17.21` by closing Renovate's PR
1. Renovate assumes you don't want any updates to `4.17.21` of `lodash`
1. Renovate creates a new PR when the branch + title "uniqueness" exists again, like when `lodash@4.17.22` releases

Renovate behaves similarly for `major` updates, for example:

1. You ignored a `major` update for Lodash (pr title: "Update lodash to v4") by closing Renovate's PR
1. Renovate assumes you don't want any updates to `v4` of `lodash`
1. Renovate won't create any update PRs for `v4` of `lodash`, even if there are newer versions of `v4`

## Immortal PRs

Some Renovate pull requests have a section like this:

> 👻 **Immortal:** This PR will be recreated if closed unmerged. Get [config help](https://github.com/renovatebot/renovate/discussions) if that's undesired.

An **immortal** PR keeps popping up again after you close it.

This document explains why we have immortal PRs, and how you can fix them.

### Why we have immortal PRs

First off, we don't have immortal PRs for some philosphical reason like: "don't ignore this update, it's good for you!".
We have no good way to ignore some PRs after they're closed.

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
Then we could allow such PRs to be closed/ignored but then as soon as there's any chance to files/packages/versions being updated then we'd be cache busted and create a new PR.
If you regularly wish to close immortal PRs, it's an indication that you may be grouping too widely.

### How to fix immortal PRs

Avoid grouping dependencies together which have different versions, or which you have a high chance of wanting to ignore.
If you have immortal PRs which you want to keep closed, then set `"recreateWhen": "never"`.

#### Major updates require Dependency Dashboard approval

Avoid grouping major upgrades together unless they are related dependencies.
Instead, set `"dependencyDashboardApproval": true` for major updates so that you have control about when they are created.

## Ignoring PRs

Close a Renovate PR to ignore it.

<!-- prettier-ignore -->
!!! note
    Renovate re-creates any PRs that are marked "immortal".
    This means that any immortal PR you close, pops up again the next time Renovate runs.
    To ignore immortal PRs, follow the advice in the [How to fix immortal PRs](#how-to-fix-immortal-prs) section.
