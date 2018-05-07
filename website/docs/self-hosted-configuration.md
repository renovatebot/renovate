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

## forkMode

You probably have no need for this option - it is an experimental setting for the Renovate hosted GitHub App.

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
