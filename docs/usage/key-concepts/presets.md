---
title: Presets
description: Learn about Renovate configuration presets
---

This document describes Renovate configuration presets and why you should use them.

To learn how to create your own presets, how to host them, and how to extend from presets read the [Shareable Config Presets](../config-presets.md) page.

## Why you should use presets

Use presets to:

- Set up the bot with good default settings
- Reduce duplication of your configuration
- Share your configuration with others
- Use somebody else's configuration and extend it with your own rules

## How to use presets

Let's say you're using the `config:recommended` preset, and want to pin your GitHub Action digests.
Instead of writing your own Renovate config, you search through Renovate's built-in presets.
You find the the `helpers:pinGitHubActionDigests` preset and add it to the `extends` array:

```json
{
  "extends": ["config:recommended", "helpers:pinGitHubActionDigests"]
}
```

Renovate now follows the rules for `config:recommended` plus the rules for `helpers:pinGitHubActionDigests`.
If there is a logical conflict between presets, then the last preset in the array wins.

## Managing config for many repositories

If you manage Renovate for many repositories, then you should create a global preset configuration.
Then you extend the global preset in each repository.
This way you have all global configuration in a single file, in a single repository.

## Presets are modular

Preset configs are modular, they can be as small as a single package rule or as large as an entire configuration.
This is similar to the way you can share ESLint configurations.

## Built-in presets

Renovate comes with a lot of built-in presets that you can use.
Browse [Renovate's default presets](https://docs.renovatebot.com/presets-default/) to find any that are useful to you.
Once you find a preset you like, put it in an `extends` array in your config file.

### Contributing a new built-in preset

If you have a Renovate config that may help others, you can put it into Renovate's built-in presets.

Read [Contributing to presets](../config-presets.md#contributing-to-presets) to learn how.

## Summary

In short:

- Browse [Renovate's default presets](https://docs.renovatebot.com/presets-default/) to find any that are useful to you
- Publish your own if you wish to reuse them across repositories
