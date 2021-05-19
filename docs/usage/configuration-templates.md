---
title: Config Template Editing
description: How to edit Renovate's config templates
---

# Config Template Editing

This document describes how you can edit branch names, commit messages, PR titles and PR content.

## Branch Name

The branch name is very important for Renovate because it helps determine "grouping" of updates, and also makes it efficient when an existing PR needs to be updated when a newer version of a package is released.
If you change the `branchPrefix` while you have ignored some upgrades (closed PR without merging), you might get a duplicate PR after the new `branchPrefix` setting is picked up by the bot.

`branchName` default value is `{{{branchPrefix}}}{{{additionalBranchPrefix}}}{{{branchTopic}}}`.

The most common branch name you will see looks like this: `renovate/react-16.x`.
In this example, the `branchPrefix` is the default `renovate/`, `additionalBranchPrefix` is empty, and `branchTopic` is `react-16.x`.

Most users will be happy with the default `branchPrefix` of `renovate/`, but you can change this if you don't like the default.
Say you don't want the forward slashes, in that case you would use `renovate-` as your `branchPrefix`.
The onboarding PR will always use `renovate/configure`.

`additionalBranchPrefix` is optional and by default is empty.

`branchTopic` depends on the package manager and upgrade type, so you will see a lot of variety.
This is probably a setting you want to change yourself.
Be careful, and consider creating a new "config help" post at the [discussions tab in the Renovate repository](https://github.com/renovatebot/renovate/discussions) to get help from the Renovate team with your config.

## Commit Message

Renovate will use one commit per branch, this makes it easy for you to merge.
As such, the `commitMessage` reflects the contents of the branch and is usually the same as the PR title.

`commitMessage` has a default value of `{{commitMessagePrefix}} {{commitMessageAction}} {{commitMessageTopic}} {{commitMessageExtra}} {{commitMessageSuffix}}`, with the intention that you only edit some of those subcomponents.

You usually don't need to edit `commitMessagePrefix`, this option is used by Renovate if it needs to add a prefix to conform to the Semantic Commit convention.
Do not touch this unless you know what you're doing.

`commitMessageAction` is usually just one word, e.g. 'Update', 'Pin', 'Refresh', etc.
You're probably fine leaving this setting alone, though you can change it.
e.g. if you prefer that Renovate uses the term 'Upgrade' instead of 'Update' then you could configure `"commitMessageAction": "Upgrade"`.

`commitMessageTopic` is usually two to three words that identify _what_ is being updated.
e.g. it might be `dependency react` or `Docker image ubuntu`.
You may want to edit this.
If you think your new `commitMessageTopic` is helpful for others, please [open a PR](https://github.com/renovatebot/renovate/pulls).

`commitMessageExtra` refers to the version being updated to.
e.g. `to v16` for a major upgrade, or `to v16.0.3` for a patch update.
It can be empty in some cases, like if the action/topic doesn't change a package version, e.g. `Pin Docker digests`.

`commitMessageSuffix` defaults to empty but is currently used in two cases:

- Differentiating major from non-major groups
- Differentiating between PRs from different base branches, maybe for `major` updates you always want the PR to end with `(MAJOR)`, for instance

`commitBody` is used if you wish to add multi-line commit messages, such as for the `Signed-off-by` fields, or adding `[skip-ci]`, etc.
It is appended to the generated `commitMessage`, separated by a newline.

## PR Title

Because commit messages match with the PR title, the PR title template defaults to `null` and inherits/copies the value from `commitMessage`.
If you have a requirement where `prTitle` should be different from `commitMessage`, then please [raise a feature request](https://github.com/renovatebot/renovate/issues) for discussion.

## PR Body

You can change the PR body in the following ways:

- Change the entire layout/flow by using `prBodyTemplate` (we do not recommend this)
- Add a header by using `prHeader`
- Add a footer by using `prFooter`
- Add a note by using `prBodyNotes`
- Edit the embedded table by using `prBodyDefinitions` and `prBodyColumns`
