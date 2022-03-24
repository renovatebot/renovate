---
title: puppet
description: puppet support in Renovate
---

# Automated Dependency Updates for Puppetfile Dependencies

Renovate can upgrade dependencies in puppet's `Puppetfile`.

## How It Works

1. Renovate searches in each repository for any `Puppetfile` files
1. Existing dependencies are extracted from the relevant sections of the file
1. Renovate resolves the dependency on the provided forges (or uses `https://forgeapi.puppetlabs.com` as default)
1. A PR is created with `Puppetfile` updated in the same commit
1. If the source repository has either a "changelog" file or uses GitHub releases, then Release Notes for each version will be embedded in the generated PR

## Enabling

Either install the [Renovate App](https://github.com/apps/renovate) on GitHub, or check out [Renovate OSS](https://github.com/renovatebot/renovate) for self-hosted.
