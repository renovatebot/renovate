---
title: Immortal pull requests
description: Learn about immortal pull requests
---

# Introduction

Some Renovate pull requests have a section like this:

> 👻 **Immortal:** This PR will be recreated if closed unmerged. Get [config help](https://github.com/renovatebot/renovate/discussions) if that's undesired.

A **immortal** PRs keeps popping up again after you close it.

This document explains why we have immortal PRs, and how you can fix them.

## Why we have immortal PRs

First off, we don't have immortal PRs for some philosphical reason like: "don't ignore this update, it's good for you!".
We just have no way to ignore some PRs after they're closed.

### Branch name and PR title are cache keys

Renovate uses the branch name and PR title like a cache key.
If the same key exists _and_ the PR was closed, then we ignore the PR.

#### Cache keys can cause problems

Let's say you have an "All non-major updates" PR.
If you close the PR, and Renovate ignores it based on the PR title, then you would never get a non-major update again.

### Only unique version PRs can be ignored

Renovate can only ignore PRs if they have a unique version, like "to v16.1.2" or "to v16" in the title.

### Grouped updates with different versions

The problem comes when there are groups of updates which have different versions.
Then the update becomes "Update react (major)", which is not safely ignorable, instead of "Update react to v16".

## Future plans for immortal PRs

In the future we may embed metadata in each PR identifying the exact files and packages + versions that PR contains.
Then we could allow such PRs to be closed/ignored but then as soon as there's any chance to files/packages/versions being updated then we'd be cached busted and create a new PR.

## How to fix immortal PRs

...TODO...

### Major updates require Dependency Dashboard approval

BTW in my own workflows I default all major updates to require Dependency Dashboard approval.
That way I open them on demand, and if we need to close them then they don't get recreated automatically - they go back to requiring dashboard approval.
