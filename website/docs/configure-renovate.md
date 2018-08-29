---
title: Configure Renovate (Onboarding PR)
description: How to onboard Renovate via a Pull Request
---

# Configure Renovate (Onboarding PR)

Once you have enabled Renovate on a repository, you will receive a "Configure Renovate" Pull Request looking something like this:

![Onboarding](assets/images/onboarding.png)

## No Risk Onboarding

Conveniently, Renovate will not make any changes to your repository or raise any further Pull Requests until after you _merge_ this initial Pull Request. So if there is anything about the Pull Request that you don't like or understand, take your time to read [documentation](./) or ask questions in one of our support forums and merge the PR only once you're satisfied with the result. You can edit your Renovate configuration **within this `renovate/configure` branch** and Renovate will keep updating the description in the PR to match, so you can keep doing that until you're satisfied with the results.

## Check for Warnings

If you have any Warnings or Errors listed, see if you need or want to make any changes to address them. If you do, then make them in your base branch (e.g. `master`) so that Renovate can recreate its Configure Renovate PR from it on its next cycle.

## Configuration Location

The Configure Renovate PR will include a `renovate.json` file in the root directory, with suggested default settings.

If you don't want to have an additional file (`renovate.json`) in your repository then you can instead add the same settings to a `"renovate"` section in your `package.json`, if you are already using this (e.g. javascript project). Any settings made in `package.json` will apply to the whole project (including other, nested `package.json` files).

Alternatively, if you prefer to use "dot files" then you can add the same JSON configuration to either a `.renovaterc` file or `.renovaterc.json` file instead of `renovate.json`.

## Customised Defaults

Most of the settings in the `renovate.json` onboarding configuration are defaults, however usually this configuration file will have some default overrides in it, such as:

- Automatically enabling angular-style semantic commits if your repository uses them
- Determining whether to use dependency range pinning depending on the detected project type

## Common Overrides

Please check the docs on this website for an exhaustive Configuration Reference, however here are some of the most commonly changed (overridden) configuration settings:

- **rangeStrategy**: By default (with zero config) it's `"replace"` however the `"config:base"` preset overrides it to `"auto"`. If you don't want to pin dependency versions and retain ranges, add the `":preserveSemverRanges"` preset to the `extends` array.
- **labels**: Labels to assign to Pull Requests
- **assignees**: GitHub users to assign the Pull Requests to

Renovate will update your PR description each time it finds changes.

## Merge

Once you're done checking and configuring in your Configure Renovate PR, it's time to merge it to enable the real Pull Requests to begin.
