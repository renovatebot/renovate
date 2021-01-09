---
title: Updating and Recreating branches
description: How Renovate Updates and Recreates branches
---

# Updating and Recreating branches

There are many situations in which Renovate must update/recreate a branch.

Here is a list of the most common cases where Renovate must update/recreate the branch:

- When a pull request has conflicts due to changes on the base branch
- When you have enabled "Require branches to be up to date before merging" on GitHub
- When you have manually told Renovate to recreate the branch when it gets behind the base branch with `"recreateWhen": "behind-base-branch"`
- When a newer version of the dependency is released
- When you request Renovate bot to recreate the branch

## If you made edits to a Renovate branch

First of all, here is the one time when Renovate _won't_ update branches.
If you edit a Renovate branch directly (e.g. to make a code fix to allow tests to pass again) then Renovate stops all updates of that branch.
It is up to you to either finish the job and merge the PR, or rename it and close it so that Renovate can take back over again.

## Recreating conflicted PRs

If new commits to the base branch - such as merging another Renovate PR - result in an open Renovate PR having merge conflicts, then Renovate will recreate any conflicted PRs.
This applies both to commits to dependency files such as `package.json` as well as lock files such as `yarn.lock`.
You should not ever need to resolve such conflicts manually.
You can disable this functionality by configuring `"recreateWhen": "never"` (not recommended).

## Recreating out-of-date branches

There are two cases where Renovate will recreate its branches off the base branch every time they are out of date:

1. If you manually configure `"recreateWhen": "behind-base-branch"`
1. If you have enabled "Require branches to be up to date before merging" on GitHub protected branches settings, and `recreateWhen` has default value `"auto"`

In that case Renovate PRs will be continuously recreated off the repository's base branch whenever necessary, even if the PRs are not conflicted.

## Newer dependency versions

If you have a exiting PR to upgrade dependency "foo" to 1.1.0, and later 1.1.1 is released, then Renovate will regenerate the branch.
This way:

- Each Renovate branch always has 1 and only 1 commit
- The newest version will be based off the latest base branch commit at the time

## Manual branch recreation

You can request that Renovate recreate a PR by ticking the recreate/retry checkbox on GitHub or Gitlab.
Or you can add a "recreate" label to the PR.
The label name is configurable via the `recreateLabel` option.

If you apply a recreate label then Renovate will regenerate its commit for the branch, even if the branch has been modified.
Therefore it is useful in situations such as:

- If a branch is stale but you don't have `recreateWhen=behind-base-branch` enabled
- If a branch has been edited and you want to discard the edits and have Renovate create it again
- If a branch was created with an error (e.g. lockfile generation) and you want Renovate to try again
