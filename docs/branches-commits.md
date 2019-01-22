# Branches and Commits Methodology

## Multiple files per branch

Renovate can/should update multiple files in the same branch/PR. e.g. it might be `package.json` and `yarn.lock`, or it might be multiple `package.json` files in a monorepo.

## One commit per branch

To keep things neat from a user perspective, and simplify things from Renovate's perspective, we aim to always use just one commit per branch, even when multiple files need updating.

A positive side effect of this is that it allows us to have a shortcut rule of, "If there's only one commit in the branch then it's clean, otherwise it must have been edited by users and we should stop updating it".

## Updating branches

If files in an already-existing branch need updating (e.g. an even newer version has been released), then we still aim to have just one commit. We achieve this in different ways per-platform.

#### GitHub

For GitHub, we use the low-level `git`-based API to manually make the commits and essentially "force push" to the existing branch without closing it. It's important to do this way because if you close a branch with a PR attached then the PR will be automatically closed by GitHub.

#### GitLab

In GitLab, Merge Request are not automatically closed if you delete the associated branch, so that gives us more flexibility. Therefore the way we update a branch is simply to delete it and then create the branch + commits again, and GitLab immediately reassociates the new (single) commit with the existing PR.

#### Azure DevOps

Azure DevOps is implemented similarly to GitLab.
