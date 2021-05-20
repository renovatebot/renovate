---
title: Reconfiguring Renovate
description: How to reconfigure Renovate after it's onboarded
---

# Reconfiguring Renovate

There will be times when you need to change your Renovate config.
There are two recommended approaches:

- Reconfigure via PR
- Nuke the config and re-onboard

## Reconfigure via PR

If you want to make config edits directly, follow these steps:

1. Create a new Git branch to work on
1. Install the `renovate` package globally (`npm i -g renovate` or `yarn global add renovate`) to get the `renovate-config-validator` program
1. Edit your Renovate configuration file
1. Validate your config by running `renovate-config-validator`
1. If the improved config passes the validation, merge the branch into your mainline branch

## Nuke config and re-onboard

Perhaps you really liked the interactive onboarding PR and want to use it again.
You can follow the steps below to nuke the config and get a new PR.
Any existing Renovate PRs will be closed after you've completed these steps.

1. Find your original `Configure Renovate` PR
1. Rename the original PR to something else, e.g. `Configure Renovate - old`
1. Remove the current Renovate configuration file (e.g. `renovate.json`) from your mainline branch

Following these steps will trick Renovate into thinking that your repository was _never_ onboarded, and will trigger a new "Configure Renovate" PR.

## Renovate config file validation when using CircleCI

If you use CircleCI, you can use the third-party [daniel-shuy/renovate](https://circleci.com/developer/orbs/orb/daniel-shuy/renovate) orb to validate your config as part of your workflow, e.g.

```yml
version: '2.1'
orbs:
  renovate: daniel-shuy/renovate@2.1
workflows:
  lint:
    jobs:
      - renovate/validate-config
```
