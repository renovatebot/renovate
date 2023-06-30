---
title: Semantic Commit messages
description: Configuring Renovate to use Semantic Commits
---

# Semantic Commit messages

Renovate looks at the last 10 commit messages in the base branch to decide if the repository uses semantic commits.
If there are semantic commits, Renovate uses the [conventional-commits-detector](https://github.com/conventional-changelog/conventional-commits-detector) to decide what convention the commit messages follow.

Renovate only finds Angular-style conventional commits, it ignores other commit conventions.

When Renovate finds Angular-style commits, Renovate creates commit messages and PR titles like this:

- chore(deps): update eslint to v7.30.0

By default, Renovate uses the `chore` prefix.

If you extend from `config:recommended` then Renovate:

- still defaults to the `chore` prefix
- uses the `fix` prefix for npm production dependencies
- uses the `chore` prefix for npm development dependencies (`devDependencies`)

## Manually enabling or disabling semantic commits

You can override the default settings, and disable or enable semantic commits.

If you want Renovate to use semantic commits: add `":semanticCommits"` to your `extends` array:

```json
{
  "extends": [":semanticCommits"]
}
```

If you want Renovate to stop using semantic commits: add `":semanticCommitsDisabled"` to your `extends` array:

```json
{
  "extends": [":semanticCommitsDisabled"]
}
```

## Changing the Semantic Commit type

You can change the Semantic Commit type that Renovate uses.
For example:

- If you want Renovate to use the "chore" type for every PR, add `":semanticCommitTypeAll(chore)"` to your `extends` array:

  ```json
  {
    "extends": [":semanticCommitTypeAll(chore)"]
  }
  ```

  PR titles and commit messages start with `chore(deps):`.

- If you want Renovate to use the "ci" type for every PR, add `":semanticCommitTypeAll(ci)"` to your `extends` array:

  ```json
  {
    "extends": [":semanticCommitTypeAll(ci)"]
  }
  ```

  PR titles and commit messages start with `ci(deps):`.

## Changing the Semantic Commit scope

You can set your own word for the scope if you don't like the default "deps" scope.
For example, to set the scope to "package", add the preset `":semanticCommitScope(package)"` to your `extends` array:

```json
{
  "extends": [":semanticCommitScope(package)"]
}
```

To _remove_ the semantic commit scope, so Renovate uses `chore:` instead of `chore(deps):`, add the `":semanticCommitScopeDisabled"` preset to your `extends` array:

```json
{
  "extends": [":semanticCommitScopeDisabled"]
}
```
