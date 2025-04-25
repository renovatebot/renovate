---
title: Presets
description: Learn about Renovate configuration presets
---

This document describes Renovate configuration presets and why you should use them.

To learn how to create your own presets, how to host them, and how to extend from presets read the [Shareable Config Presets](../config-presets.md) page.

## Why you should use presets

Use presets to:

- Set up the bot with good default settings
- Avoid duplicating your configuration
- Share your configuration with others
- Use somebody else's configuration as-is, or extend it with your own rules

## How to use presets

Say you're using the `config:recommended` preset, and want to pin your GitHub Action digests.
Instead of writing your own Renovate config, you search the docs, and find the `helpers:pinGitHubActionDigests` preset.
Then you add the preset to the `"extends"` array in your Renovate configuration file:

```json
{
  "extends": ["config:recommended", "helpers:pinGitHubActionDigests"]
}
```

In the example above, Renovate follows the rules from the `config:recommended` preset, plus the rules for `helpers:pinGitHubActionDigests`.

<!-- prettier-ignore -->
!!! tip
    If there is a logical conflict between presets, then the _last_ preset in the `"extends"` array "wins".

## Managing config for many repositories

If you manage the Renovate configuration for many repositories, we recommend that you:

1. Create a global preset configuration
1. Extend from the global preset in all of the repositories that should use your global preset as base

This way, when you want to change your global Renovate configuration, you only need to edit the global preset file.

## Presets are modular

Preset configs are modular: a preset can be as small or large as you need.
A preset can even extend from _other_ presets.

## Built-in presets

Renovate comes with many built-in presets.
We recommend you browse [Renovate's default presets](../presets-default.md).
Again, to use the preset: add it to the `"extends"` array in your Renovate config file.

### Contributing a new built-in preset

If you have a Renovate config that may help others, you can put it into Renovate's built-in presets.
Read [Contributing to presets](../config-presets.md#contributing-to-presets) to learn how.

## Summary

In short:

- Browse [Renovate's default presets](../presets-default.md), or our other presets, to find helpful presets
- Use presets by putting them in the `"extends"` array in your Renovate config file
- To manage the Renovate configuration for many repositories at once, create a global preset config file
- The order of presets matters: in a logical conflict, the last preset in the `"extends"` array "wins"
