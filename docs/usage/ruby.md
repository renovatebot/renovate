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

## Warnings

When using `"rangeStrategy": "update-lockfile"`, all gems listed in the `Gemfile` will be updated, even if they do not have a version specified.

When using other `rangeStrategy` options, Renovate doesn't update dependencies without a version constraint.
Example: `gem 'some-gem', '~> 1.2.3'` will update `some-gem` if a new version matching the constraint is available, but `gem 'some-gem'` won't.
If you always want to have the latest available version, consider specifying `gem 'some-gem', '> 0'`.

## Enabling

You can install the [Renovate App](https://github.com/apps/renovate) on GitHub.
Or you can check out [Renovate OSS](https://github.com/renovatebot/renovate) to self-host Renovate.
