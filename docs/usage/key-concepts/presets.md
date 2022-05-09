---
title: Presets
description: Learn about Renovate configuration presets
---

This document describes Renovate configuration presets and why you should use them.

To learn how to create your own presets, how to host them, and how to extend from presets read the [Shareable Config Presets](./config-presets.md) page.

## Why you should use presets

Use presets to:

- Set up the bot with good default settings
- Reduce duplication of your configuration
- Share your configuration with others
- Use somebody else's configuration and extend it with your own rules

## Managing config for many repositories

If you manage Renovate for many repositories, then you should create a global preset configuration.
Then you extend the global preset in each repository.
This way you have all global configuration in a single file, in a single repository.

## Presets are modular

Preset configs are modular, they can be as small as a single package rule or as large as an entire configuration, just like an ESLint config.

## Built-in presets

Renovate comes with a lot of built-in presets that you can use.
Browse [Renovate's default presets](https://docs.renovatebot.com/presets-default/) to find any that are useful to you.
Once you find a preset you like, put it in an `extends` array in your config file.

## Summary

In short:

- Browse [Renovate's default presets](https://docs.renovatebot.com/presets-default/) to find any that are useful to you
- Publish your own if you wish to reuse them across repositories
