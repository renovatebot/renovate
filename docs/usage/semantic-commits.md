---
title: Semantic Commit Messages
description: Configuring Renovate to use Semantic Commits
---

# Semantic Commit Messages

Renovate attempts to autodetect if your repository uses "semantic" commit message prefixes, and adds them if so. To do so, it looks at the 10 most recent commit messages in the base branch and uses [conventional-commits-detector](https://github.com/conventional-changelog/conventional-commits-detector) to determine convention commit type.

Currently, Renovate ignores commit conventions apart from "angular".

If angular-style commits are found then Renovate will structure its commit messages and PR titles to be like so:

- chore(deps): update eslint to v4.2.0
- fix(deps): update express to v4.16.2

`chore` is used by default, but `fix` is used for anything in the "dependencies" section of `package.json`.

## Manually enabling or disabling semantic commits

If you wish to manually override Renovate's semantic commit detection, then you can add either `":semanticCommits"` or `":semanticCommitsDisabled"` to your `extends` array.

## Changing the Semantic Commit Type

If you wish to say use "chore" for every PR, then you can add `":semanticCommitTypeAll(chore)"` to your `extends` array. Or if you wish to use `ci` then you would add `":semanticCommitTypeAll(ci)"` instead. This second case would mean your PR titles and commit messages will start with "ci(deps):".

## Changing the Semantic Commit Scope

If you don't like "deps" then this can also be configured. For example, to set it to "package" you should add the preset `":semanticCommitScope(package)"` to your `extends` array.

If you wish to _remove_ the semantic commit scope (e.g. use prefix `chore:` instead of `chore(deps):`) then you should add the preset `":semanticCommitScopeDisabled"` to your `extends` array.
