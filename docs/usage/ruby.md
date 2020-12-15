---
title: Ruby Bundler support
description: Ruby Bundler support in Renovate
---

# Automated dependency updates for Ruby Bundler dependencies

Renovate supports upgrading dependencies in Bundler's Gemfiles and their accompanying `Gemfile.lock` files.

## How it works

1. Renovate searches in each repository for any Gemfiles
1. Existing dependencies are extracted from the Gemfiles
1. Renovate resolves the dependency on Rubygems.org (or elsewhere if configured), and checks for newer versions
1. A PR is created which updates the `Gemfile` and `Gemfile.lock` in a single commit
1. If the source repository has a "changelog" file or uses GitHub releases, then Release Notes for each version are embedded in the generated PR

## Enabling

You can install the [Renovate App](https://github.com/apps/renovate) on GitHub.
Or you can check out [Renovate OSS](https://github.com/renovatebot/renovate) to self-host Renovate.
