---
title: Closed PRs
description: How Renovate handles closed PRs
---

# Ignoring closed PRs

By default renovate will ignore closed PRs and won't raise any PRs for same versions.
If you want renovate to ignore closed PRs, then make the following changes to the closed PR -

- either you can rename it
- or you can add a label "**renovate-ignore**" to it

In both the scenarios, renovate will create a new PR on its next run.
