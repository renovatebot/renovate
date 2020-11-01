# Branches and Commits Methodology

## Multiple files per branch

Renovate can/should update multiple files in the same branch/PR.
e.g. it might be `package.json` and `yarn.lock`, or it might be multiple `package.json` files in a monorepo.

## One commit per branch

To keep things neat from a user perspective, and simplify things from Renovate's perspective, we aim to always use just one commit per branch, even when multiple files need updating.

A positive side effect of this is that it allows us to have a shortcut rule of, "If there's only one commit in the branch then it's clean, otherwise it must have been edited by users and we should stop updating it".

## Updating branches

If files in an already-existing branch need updating (e.g. an even newer version has been released), then we still aim to have just one commit.
We achieve this by force pushing with `git` to the existing branch.
