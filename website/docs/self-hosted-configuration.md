---
title: Self-Hosted Configuration
description: Self-Hosted Configuration usable in renovate.json or package.json
---

# Self-Hosted Configuration Options

The below configuration options are applicable only if you are running your own instance ("bot") of Renovate.

## autodiscover

Be cautious when using this option - it will run Renovate over _every_ repository that the bot account has access to.

## endpoint

## exposeEnv

## force

This object is used as a "force override" when you need to make sure certain configuration overrides whatever is configured in the repository. For example, forcing a null (no) schedule to make sure Renovate raises PRs on a run even if the repository itself or its preset defines a schedule that's currently in active.

In practice, it is implemented by converting the `force` configuration into a `packageRule` that matches all packages.

## forceCli

This is set to true by default, meaning that any settings (such as `schedule`) take maximum priority even against custom settings existing inside individual repositories.

## forkMode

You probably have no need for this option - it is an experimental setting for the Renovate hosted GitHub App.

## gitAuthor

RFC5322-compliant string if you wish to customise the git author for commits.

## gitPrivateKey

## logFile

## logFileLevel

## logLevel

## mirrorMode

You probably have no need for this option - it is an experimental setting for the Renovate hosted GitHub App.

## onboarding

Set this to `false` if (a) you configure Renovate entirely on the bot side (i.e. empty `renovate.json` in repositories) and (b) you wish to run Renovate on every repository the bot has access to, and (c) you wish to skip the onboarding PRs.

## onboardingConfig

## platform

## prFooter

## privateKey

## repositories

## requireConfig

## token
