# Branches and Commits Methodology

## Multiple files per branch

Renovate can, and should, update multiple files in the same branch/PR.

e.g. Renovate can update the `package.json` and the corresponding `yarn.lock` file in the same commit.
The bot can also update multiple package files at once in a monorepo, including from different package managers.

## One commit per branch

To keep things neat: Renovate always makes one commit per branch, even when multiple files need updating.
This way we can use the following logic:

- If the last commit in a branch was using Renovate's identity, we assume it to be clean.
- If the last commit in a branch is by an identity other than Renovate's, the branch is assumed to have been edited by users and Renovate will not push to it any longer.

## Updating branches

If files in an already-existing branch need updating (e.g. an even newer version has been released), then we still want to have only one commit.
Renovate achieves this by force pushing the necessary changes to the existing branch with `git`.
