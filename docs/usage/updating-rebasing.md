---
title: Updating and Rebasing branches
description: How Renovate Updates and Rebases branches
---

# Updating and rebasing branches

There are many situations in which Renovate must update/rebase a branch.

Here is a list of the most common cases where Renovate must update/rebase the branch:

- When a pull request has conflicts due to changes on the base branch
- When you have enabled "Require branches to be up to date before merging" on GitHub
- When you have manually told Renovate to rebase when behind the base branch with `"rebaseWhen": "behind-base-branch"`
- When a newer version of the dependency is released
- When you request a manual rebase from the Renovate bot
- When you use `"automerge": true` and `"rebaseWhen": "auto"` on a branch / pr

Renovate uses its own version of "rebasing", which is _not the same_ as doing a `git rebase` with Git.
Instead, Renovate reapplies all updates into a new commit based off of the head of the base branch.

## No rebasing if you have made edits

First of all, here is the one time when Renovate _won't_ update branches.
If you edit a Renovate branch directly (e.g. to make a code fix to allow tests to pass again) then Renovate stops all updates of that branch.
It is up to you to either finish the job and merge the PR, or rename it and close it so that Renovate can take back over again.

## Rebasing conflicted PRs

If new commits to the base branch - such as merging another Renovate PR - result in an open Renovate PR having merge conflicts, then Renovate will recreate ("rebase") any conflicted PRs.
This applies both to commits to dependency files such as `package.json` as well as lock files such as `yarn.lock`.
You should not ever need to resolve such conflicts manually.
You can disable this functionality by configuring `"rebaseWhen": "never"` (not recommended).

## Rebasing out-of-date branches

There are multiple cases where Renovate will rebase its branches off the base branch every time they are out of date:

1. If you configure `"rebaseWhen": "behind-base-branch"`
1. If you use the default configuration `"rebaseWhen": "auto"` and the repository has a requirement that branches must be up-to-date before merging (e.g. "Require branches to be up to date before merging" on GitHub, or fast-forward-only settings on Bitbucket Server or GitLab)
1. If you use the default configuration `"rebaseWhen" : "auto"` and configure `"automerge" : true`

In that case Renovate PRs will be rebased off the repository's base branch whenever they are behind the base branch, even if the PRs are not conflicted.

## Newer dependency versions

If an existing PR is open to upgrade dependency "foo" to v1.1.0 and then v1.1.1 is released, then Renovate will regenerate the branch again.
This way:

- Each Renovate branch will always have 1 and only 1 commit
- The newest version will be based off the latest base branch commit at the time

## Manual rebasing

You can request that Renovate rebase a PR by ticking the rebase/retry checkbox on GitHub or GitLab.
Or you can add a "rebase" label to the PR.
The label name is configurable via the `rebaseLabel` option.

If you apply a rebase label then Renovate will regenerate its commit for the branch, even if the branch has been modified.
The rebase label is useful in situations like:

- If a branch is behind the base branch but you don't have `rebaseWhen=behind-base-branch` enabled
- If a branch has been edited and you want to discard the edits and have Renovate create it again
- If a branch was created with an error (e.g. lockfile generation) and you want Renovate to try again
