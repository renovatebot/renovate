---
title: Reconfiguring Renovate
description: How to reconfigure Renovate once it's onboarded
---

# Reconfiguring Renovate

There will likely be times when you need to change your Renovate config. There are two recommended approaches:

## Reconfigure via PR

Create a PR that includes "Renovate" in its title, e.g. "Reconfigure Renovate" or "Update Renovate Configuration". Doing so will flag it to Renovate the next time it runs.

If Renovate detects that such a PR includes changes to any of the Renovate configuratino files (e.g. `renovate.json`) then it will run its validation against this new config and set a status check result of "success" if it passes or "failed" if it does not. This way you can be sure that your config is at least valid before merging.

## Nuke config and re-onboard

Perhaps you really liked the interactive PR and want to see it again. In that case:

1.  Find and rename your original `Configure Renovate` PR (e.g. appending " - old" to the title)
2.  Delete your Renovate config from your base branch

This will be enough to trick Renovate into thinking that the repository was _never_ onboarded and it will trigger a Configure Renovate PR again. Any existing Renovate PRs may be closed, however.
