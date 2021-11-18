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

## Caveats

If a dependency has no version constraint, renovate will assume the version constraint `>= 0`.
In such cases the `rangeStrategy` will be set automatically to `update-lockfile` and updates will only be done in the `Gemfile.lock` file.
To avoid breaking changes it is highly recommended to specify a version constraint and pin at least the major version, e.g. `gem 'some-gem', '~> 2.0'`.

## Enabling

You can install the [Renovate App](https://github.com/apps/renovate) on GitHub.
Or you can check out [Renovate OSS](https://github.com/renovatebot/renovate) to self-host Renovate.
