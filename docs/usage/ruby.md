---
title: Ruby Bundler Support
description: Ruby Bundler support in Renovate
---

# Automated Dependency Updates for Ruby Bundler Dependencies

Renovate supports upgrading dependencies in Bundler's `Gemfile`s and their accompanying `Gemfile.lock` files.
Support is considered "alpha" stage until there have been some more real-world tests.

## How It Works

1.  Renovate will search each repository for any `Gemfile` files.
2.  Existing dependencies will be extracted from the files
3.  Renovate will resolve the dependency on Rubygems or elsewhere if configured, and look for any newer versions
4.  A PR will be created with `Gemfile` and `Gemfile.lock` updated in the same commit
5.  If the source repository has either a "changelog" file or uses GitHub releases, then Release Notes for each version will be embedded in the generated PR.

## Enabling

Either install the [Renovate App](https://github.com/apps/renovate) on GitHub, or check out [Renovate OSS](https://github.com/renovatebot/renovate) for self-hosted.
Bundler support is now enabled by default in both.

## Future work

- Updating `.gemspec` files
- Pinning dependencies to the version found in `Gemfile.lock` rather than the latest matching version
- Lock file maintenance
- Selective lock file updating (if ranges are in use in the `Gemfile`)
