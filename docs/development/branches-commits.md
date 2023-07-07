# Branches and commits behavior

## Multiple files per branch

Renovate can, and should, update multiple files in the same branch/PR.
For example:

- update the `package.json` and the `yarn.lock` file
- update multiple package files in a monorepo, including different package managers

## One commit per branch

Renovate always creates one commit per branch, even when updating multiple files.
This keeps Renovate's branches neat, so we can use the following logic:

| Last commit in branch made by | Behavior                                                    |
| ----------------------------- | ----------------------------------------------------------- |
| Renovate                      | Assume branch is clean                                      |
| Someone or something else     | Assume branch edited by user, do not push to branch anymore |

### Updating branches

We always want a single commit in Renovate's branches.
This means we let Renovate force-push a single new commit whenever it needs to.
For example:

1. Renovate creates a `renovate/jest` branch to update the Jest package to `1.0.1`
1. Renovate later finds a newer `1.1.0` version
1. Renovate force-pushes a new commit for the `1.1.0` update into its `renovate/jest` branch
