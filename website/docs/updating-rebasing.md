---
title: Updating and Rebasing Branches
description: How Renovate Updates and Rebases Branches
---

# Updating and Rebasing Branches

There are many cases where Renovate will need to update a branch/PR after its initial creation, and this document will attempt to describe them.

Note: Renovate doesn't technically do "rebasing" in the git sense. Instead, it manually recreates the same commit based off of the latest commit in base branch.

## If you have made edits

First of all, here is the one time when Renovate _won't_ update branches. If you have edited a Renovate branch directly (e.g. to make a code fix to allow tests to pass again) then Renovate will stop all updates of that branch. It is up to you to either finish the job and merge the PR, or rename it and close it so that Renovate can take back over again.

## Rebasing Conflicted PRs

If new commits to the base branch - such as merging another Renovate PR - result in an open Renovate PR having merge conflicts, then Renovate will recreate ("rebase") any conflicted PRs. This applies both to commits to dependency files such as `package.json` as well as lock files such as `yarn.lock`. You should not ever need to resolve such conflicts manually.

## Rebasing Stale Branches

There are two cases where Renovate will rebase its branches off the base branch every time they are out of date:

1.  If you manually configure `"rebaseStalePrs"` to be true.
2.  If you have enabled "Require branches to be up to date before merging" on GitHub protected branches settings

In that case Renovate PRs will be continuously rebased off the repository's base branch whenever necessary, even if the PRs are not conflicted.

## Newer Dependency Versions

If an existing PR is open to upgrade dependency "foo" to v1.1.0 and then v1.1.1 is released, then Renovate will regenerate the branch again. This way:

- Each Renovate branch will always have 1 and only 1 commit
- The newest version will be based off the latest base branch commit at the time

## Manual rebasing

In GitHub, it is possible to manually request that Renovate rebase a PR by adding the label "rebase" to it. This label name is also configurable via the `rebaseLabel` config option too.

If you apply this label then Renovate will regenerate its commit for the branch, even if the branch has been modified. Therefore it is useful in situations such as:

- If a branch is stale but you don't have `rebaseStalePrs` enabled
- If a branch has been edited and you wish to discard the edits and have Renovate create it again
- If a branch was created with an error (e.g. lockfile generation) and you wish to have it retried.
