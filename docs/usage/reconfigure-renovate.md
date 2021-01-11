---
title: Reconfiguring Renovate
description: How to reconfigure Renovate once it's onboarded
---

# Reconfiguring Renovate

There will likely be times when you need to change your Renovate config.
There are two recommended approaches:

## Reconfigure via PR

If you wish to make config edits directly, it's recommended to do so via a PR and then run Renovate's config validator to verify it.
The validator is named `renovate-config-validator` and installed alongside `renovate` itself if you run `npm i -g renovate` or equivalent.
If it validates your new config then it should be safe to merge.

### Validation when using CircleCI

If you are using CircleCI, you can use the third-party [daniel-shuy/renovate](https://circleci.com/developer/orbs/orb/daniel-shuy/renovate) orb to validate your config as part of your workflow, e.g.

```yml
version: '2.1'
orbs:
  renovate: daniel-shuy/renovate@2.1
workflows:
  lint:
    jobs:
      - renovate/validate-config
```

## Nuke config and re-onboard

Perhaps you really liked the interactive PR and want to see it again.
In that case:

1.  Find and rename your original `Configure Renovate` PR (e.g. to `Configure Renovate - old`)
2.  Delete your Renovate config (e.g. `renovate.json`) from your base branch

This will be enough to trick Renovate into thinking that the repository was _never_ onboarded and it will trigger a new Configure Renovate PR again.
Any existing Renovate PRs in progress may be closed, however.
