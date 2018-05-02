---
title: Config Template Editing
description: How to edit Renovate's config templates
---

# Config Template Editing

Tnis document describes how you can edit the branch names, commit messages, or PR titles and content.

## Branch Name

The branch name is very important for Renovate because it helps determine "grouping" of updates, and also makes it efficient when an existing PR needs to be updated with a newer version. Also, if you change branchPrefix and have some upgrades "ignored" (closed without merging) then you may see duplicate PRs opened with your new branch name.

`branchName` has a default value of `{{{branchPrefix}}}{{{managerBranchPrefix}}}{{{branchTopic}}}`.

The most common type of branch name you will see looks like this: `renovate/react-16.x`. In this example, the `branchPrefix` is the default `renovate/`, `managerBranchPrefix` is empty, and `branchTopic` is `react-16.x`.

Most people can leave `branchPrefix` as `renovate/` however if you prefer to have no forward slashes then you might pick `renovate-` instead. Please note that the onboarding PR is fixed to use `renovate/configure` however.

`managerBranchPrefix` is optional and by default is empty for all JavaScript dependencies. We use `docker-` for all Docker updates, so you might see branches like `renovate/docker-ubuntu-16.x`.

`branchTopic` depends on the package manager and upgrade type, so you will see a lot of variety. It is also the one you might be most likely to want to change, but be careful and consider posting your config to https://github.com/renovateapp/config-help first.

## Commit Message

Renovate is designed to have just a single commit per branch, for merging convenience. As such, that commitMessage should reflect the contents of the branch and usually be the same as the PR Title.

`commitMessage` has a default value of `{{commitMessagePrefix}} {{commitMessageAction}} {{commitMessageTopic}} {{commitMessageExtra}} {{commitMessageSuffix}}`, with the intention that you only edit some of those subcomponents.

`commitMessagePrefix` is usually not necessary to configure directly, and is used by Renovate if it needs to add a prefix due to Semantic Commit conventions. Do not touch it unless you know what you're doing.

`commitMessageAction` is usually just 1 word, e.g. 'Update', 'Pin', 'Refresh', etc. It's usually also not necessary to edit, although maybe you prefer 'Upgrade' instead of 'Update'?

`commitMessageTopic` is usually 2-3 words aimed to identify _what_ is being updated. e.g. it might be `dependency react` or `Docker image ubuntu`. You may want to edit this, but if you think your idea/requirement is a good one then maybe you can propose it to the project or publish it as a preset config for others with similar requirements.

`commitMessageExtra` usually refers to the version being updated to. e.g. `to v16` for a major upgrade, or `to v16.0.3` for a patch update. It may also be empty in some cases, e.g. if the action/topic is `Pin Docker digests`.

`commitMessageSuffix` defaults to empty and is there for flexibility and future use. Maybe for `major` updates you always want the PR to end with `(MAJOR)`, for instance.

`commitBody` is used if you wish to add multi-line commit messages, such as for the `Signed-off-by` fields, or adding `[skip-ci]`, etc. It is appended to the generated `commitMessage`, separated by a newline.

## PR Title

Because commit messages should usually match with the PR title, the PR title template now defaults to `null` and inherits whatever is configured for `commitMessage`. If you have a requirement where `prTitle` should be different from `commitMessage`, then please raise a feature request for discussion.

## PR Body

The PR Body is currently a little difficult to edit because of its size, however it should soon be redesigned like the other templates to allow more easier editing without needing to copy/paste the whole template.
