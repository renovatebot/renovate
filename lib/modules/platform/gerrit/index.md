# Gerrit

## Authentication

First, ![HTTP access token](/assets/images/gerrit-http-password.png) for the bot account.

Let Renovate use your HTTP access token by doing _one_ of the following:

- Set your HTTP access token as a `password` in your `config.js` file
- Set your HTTP access token as an environment variable `RENOVATE_PASSWORD`
- Set your HTTP access token when you run Renovate in the CLI with `--password=`

Make sure this user is allowed to assign the Code-Review label with "+2" to his own changes or "automerge" can't work.

Remember to set `platform=gerrit` somewhere in your Renovate config file.

## Renovate PR/Branch-Model with Gerrit and needed Permissions

If you use the "Code-Review" label and want `automerge` working, then you have to enable `gerritAutoApprove=true` in your Renovate config.
In this case the bot will automatically add the _Code-Review_ label with the value "+2" to each created "pull-request" (Gerrit-Change).

_Important: The login should be allowed to give +2 for the Code-Review label._

**Also, you must use the following two settings. It will not work without these settings.**

```
{
  platformCommit: true, //allow to reuse the Change-Id
  gitNoVerify: ["push"], //allow-commit-hook to generate a Change-Id
}
```

**Current Workarounds/Changes to git-based-commands:**

They should be moved behind the Platform interface (optionally) to avoid such workarounds.
Perhaps it should be possible in the future to integrate a platform which is not based on Git.

- registerBranch()
  A new method which allows to register virtual branches (not really exists) including commitSHA and whether they have been "modified" from another user. (see isBranchModified below)

- isBranchModified()
  Checks if the last uploader was different to the Renovate user and store this into "branchIsModified[branchname]". For Gerrit we rely on the above pre-registration in `initRepo()`.

- isBranchConflicted()
  This one tries to merge "origin/${branchName}" into baseBranch and check for conflicts. From `initRepo()` we fetch all open gerrit-changes to the local branch-name "origin/${branchName}" to let this work as expected.

- isBranchBehindBase()
  The implementation now checks all branches (not remote only) but includes the `origin/` prefix in the match. This way the fake-branches checked out from `initRepo()` return the correct answer, and it should work for the other platforms too (because `remotes/origin/$branchname`).

- deleteBranch()
  Fails always because remote branches are not exists in real. This should be no real problem.

## TODOS

- better comment/msg "Markdown" support, Gerrit 3.7 brings better support, but still no &lt;image&gt; or &lt;details&gt; support
- Images in Markdown-Comments, needs [Gerrit-Feature](https://bugs.chromium.org/p/gerrit/issues/detail?id=2015)

## Features awaiting implementation

- setStability/setConfidence needs platform.setBranchStatus(...), what should we do with this information? Where to store it? As a gerrit-comment/message with special TAG?
- optimize/restructure gerrit-http calls (findPr returns more details then getPr...)

## Unsupported platform features/concepts

- Creating issues (not a gerrit concept) / Renovate-Dashboard.
