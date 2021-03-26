---
title: Semantic Commit messages
description: Configuring Renovate to use Semantic Commits
---

# Semantic Commit messages

To detect if your repository uses semantic commits, Renovate looks at the latest 10 commit messages in the base branch.
It then uses [conventional-commits-detector](https://github.com/conventional-changelog/conventional-commits-detector) to determine what convention the commit messages follow.

Renovate only detects Angular-style conventional commits, it ignores all other commit conventions.

When Renovate finds Angular-style commits, Renovate will create commit messages and PR titles that look like this:

- chore(deps): update eslint to v4.2.0
- fix(deps): update express to v4.16.2

Renovate uses `chore` by default, but uses `fix` for updates to your production dependencies in your `package.json` file.

## Manually enabling or disabling semantic commits

You can override the default settings, and disable or enable semantic commits.

If you want Renovate to use semantic commits: add `":semanticCommits"` to your `extends` array.

If you want Renovate to stop using semantic commits, add `":semanticCommitsDisabled"` to your `extends` array.

## Changing the Semantic Commit type

You can change the Semantic Commit type that Renovate uses.

Say you want Renovate to use "chore" for every PR, you can add `":semanticCommitTypeAll(chore)"` to your `extends` array.
PR titles and commit messages start with "chore(deps):"

Or say you want to use "ci" for every PR, then you would add `":semanticCommitTypeAll(ci)"` to your `extends` array instead.
PR titles and commit messages start with "ci(deps):"

## Changing the Semantic Commit scope

If you don't like the default "deps" scope, you can use another word for the scope instead.
For example, to set the scope to "package" instead, add the preset `":semanticCommitScope(package)"` to your `extends` array.

If you want to _remove_ the semantic commit scope (e.g. use prefix `chore:` instead of `chore(deps):`), then add the preset `":semanticCommitScopeDisabled"` to your `extends` array.
