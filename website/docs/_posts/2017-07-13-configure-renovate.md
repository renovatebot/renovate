---
date: 2017-07-12
title: Configure Renovate (Onboarding PR)
categories:
  - getting-started
description: How to onboard Renovate via a Pull Request
type: Document
order: 2
---

Once you have enabled Renovate on a repository, you will receive a "Configure Renovate" Pull Request looking something like this:

![Onboarding](/images/screenshots/onboarding.png)

## No Risk Onboarding

Conveniently, Renovate will not make any changes to your repository or raise any further Pull Requests until after you _close or merge_ this initial Pull Request. So if there is anything about the Pull Request that you don't like or understand, take your time to read [documentation](/docs) or ask questions in one of our support forums and merge the PR only once you're satisfied with the result. You can edit your Renovate configuration **within this `renovate/configure` branch** and Renovate will keep updating the description in the PR to match, so you can keep doing that until you're satisfied with the results.

## Check for Warnings

If you have any Warnings or Errors listed, see if you need or want to make any changes to address them. If you do, then make them in your base branch (e.g. `master`) so that Renovate can recreate its Configure Renovate PR from it on its next cycle.

## Configuration Location

The Configure Renovate PR will include a `renovate.json` file in the root directory, with suggested default settings.

It's not mandatory to have a `renovate.json` in your repository but strongly recommended. If Renovate's default settings work well for you then you can simply close this PR unmerged to run Renovate without _any_ override configuration. However it's recommended that you try deleting the `renovate.json` from the `renovate/configure` branch first to check that the results are as you wish.

If you want to override some of Renovate's default settings but not have a `renovate.json`, then you can instead add the same settings to a `"renovate"` section in your `package.json`. Note though that if you run a monorepo with more than one `package.json` file then you may need to add the same configuration to all of them. Again, please make these changes within the `renovate/configure` branch of this PR to make sure that the results match your expectations.

Alternatively, if you prefer to use "dot files" then you can add the same JSON configuration to either a `.renovaterc` file or `.renovaterc.json` file instead of `renovate.json`.

## Customised Defaults

Most of the settings in the `renovate.json` onboarding configuration are defaults, however usually this configuration file will have some default overrides in it, such as:

* Automatically enabling angular-style semantic commits if your repository uses them
* Setting `pinVersions` to false for `dependencies` unless your `package.json` file are all `private`

## Common Overrides

Please check the docs on this website for an exhaustive Configuration Reference, however here are some of the most commonly changed (overridden) configuration settings:

* **pinVersions**: By default it's `true` (all ranges will be converted to pinned versions) but many people prefer to keep ranges
* **labels**: Labels to assign to Pull Requests
* **assignees**: GitHub users to assign the Pull Requests to

Renovate will update your PR description each time it finds changes.

## Merge

Once you're done checking and configuring in your Configure Renovate PR, it's time to merge it to enable the real Pull Requests to begin.
