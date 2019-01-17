---
title: PHP Composer Support
description: PHP Composer support in Renovate
---

# Automated Dependency Updates for PHP Composer Dependencies

Renovate supports upgrading dependencies in PHP's `composer.json` files and their accompanying `composer.lock` lock files.

## How It Works

1.  Renovate will search each repository for any `composer.json` files.
2.  Existing dependencies will be extracted from the relevant sections of the JSON
3.  Renovate will resolve the dependency on Packagist or elsewhere if configured, and filter for semver versions
4.  A PR will be created with `composer.json` and `composer.lock` updated in the same commit
5.  If the source repository has either a "changelog" file or uses GitHub releases, then Release Notes for each version will be embedded in the generated PR.

## Enabling

Either install the [Renovate App](https://github.com/apps/renovate) on GitHub, or check out [Renovate OSS](https://github.com/renovatebot/renovate) or [Renovate Pro](https://renovatebot.com/pro) for self-hosted options.
