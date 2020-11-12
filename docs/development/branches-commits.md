# Branches and Commits Methodology

## Multiple files per branch

Renovate can, and should, update multiple files in the same branch/PR.

e.g. Renovate can update the `package.json` and the corresponding `yarn.lock` file in one go.
The bot can also update multiple `package.json` files in a monorepo.

## One commit per branch

To keep things neat: aim to use one commit per branch, even when multiple files need updating.
This way we can use the following logic:

- If there's one commit in the branch, the branch is clean.
- If there is more than one commit in the branch, then the branch has been edited by users and we stop updating the branch.

## Updating branches

If files in an already-existing branch need updating (e.g. an even newer version has been released), then we still want to have only one commit.
Do this by force pushing the necessary changes to the existing branch with `git`.
