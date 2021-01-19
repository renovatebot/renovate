---
title: Refreshing branches
description: How Renovate refreshes branches
---

# Refreshing branches

In Renovate terminology, _refreshing_ a branch means Renovate will re-apply all dependency updates in the branch on top of the latest commit from the base branch (e.g. `main`/`master`).
There are many situations in which Renovate might refresh a branch.

Here is a list of the most common cases where Renovate must refresh the branch:

- When a pull request has conflicts due to changes on the base branch
- When you have enabled "Require branches to be up to date before merging" on GitHub
- When you have manually told Renovate to refresh when behind the base branch with `"refreshWhen": "behind-base-branch"`
- When a newer version of the dependency is released
- When you request a manual refresh from the Renovate bot

## If you made edits to a Renovate branch

Renovate _won't_ refresh a branch automatically if it thinks another account has added or force-pushed commits to it.
If you've edited a Renovate branch but wish for Renovate to take over again, you can either:
 * Tick the refresh checkbox in the PR (if supported by your platform)
 * Rename the PR to start with `rebase!`
 * Add a `rebase` label to the PR
Doing so means that any additional commits will be lost once Renovate refreshes the branch.

## Refreshing conflicted PRs

If new commits to the base branch - such as merging another Renovate PR - result in an open Renovate PR having merge conflicts, then Renovate will refresh any conflicted PRs.
This applies both to commits to dependency files such as `package.json` as well as lock files such as `yarn.lock`.
You should not ever need to resolve such conflicts manually.
You can disable this functionality by configuring `"refreshWhen": "never"` (not recommended).

## Refreshing out-of-date branches

There are two cases where Renovate will refresh its branches off the base branch every time they are out of date:

1. If you manually configure `"refreshWhen": "behind-base-branch"`
1. If you have enabled "Require branches to be up to date before merging" on GitHub protected branches settings, and `refreshWhen` has default value `"auto"`

In that case Renovate PRs will be continuously refreshed off the repository's base branch whenever necessary, even if the PRs are not conflicted.

## Newer dependency versions

If you have an existing PR but even newer versions exist of a dependency in the PR then Renovate will refresh the branch to apply the newer version.
This way:

- Each Renovate branch always has 1 and only 1 commit
- The newest version will be based off the latest base branch commit at the time

## Manual refresh

You can request that Renovate refresh a PR by ticking the refresh checkbox on GitHub or Gitlab.

You can instead request a PR refresh by renaming the PR title to begin with `refresh!`.
Or you can add a "refresh" label to the PR.
The label name is configurable via the `refreshLabel` option.

If you apply a refresh label then Renovate will refresh its commit for the branch, even if the branch has been modified.
Therefore it is useful in situations such as:

- If a branch is stale but you don't have `refreshWhen=behind-base-branch` enabled
- If a branch has been edited and you want to discard the edits and have Renovate create it again
- If a branch was created with an error (e.g. lockfile generation) and you want Renovate to try again
