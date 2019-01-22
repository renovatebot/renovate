---
title: Self-Hosted Configuration
description: Self-Hosted Configuration usable in renovate.json or package.json
---

# Self-Hosted Configuration Options

The below configuration options are applicable only if you are running your own instance ("bot") of Renovate.

## autodiscover

Be cautious when using this option - it will run Renovate over _every_ repository that the bot account has access to.

## binarySource

Set this to 'global' if you wish Renovate to use globally-installed binaries (`npm`, `yarn`, etc) instead of using its bundled versions.

## dryRun

## endpoint

## force

This object is used as a "force override" when you need to make sure certain configuration overrides whatever is configured in the repository. For example, forcing a null (no) schedule to make sure Renovate raises PRs on a run even if the repository itself or its preset defines a schedule that's currently in active.

In practice, it is implemented by converting the `force` configuration into a `packageRule` that matches all packages.

## forceCli

This is set to true by default, meaning that any settings (such as `schedule`) take maximum priority even against custom settings existing inside individual repositories.

## forkMode

You probably have no need for this option - it is an experimental setting for the Renovate hosted GitHub App.

## gitAuthor

RFC5322-compliant string if you wish to customise the git author for commits.

## gitFs

This setting is experimental, and works for GitHub repositories only. If enabled, Renovate will `git clone` repos and use `git` for file operations such as creating branches and committing files.
Set it to a string specifing the transport used by Git (`https`, `http` or `ssh`).

## gitPrivateKey

## logFile

## logFileLevel

## logLevel

## onboarding

Set this to `false` if (a) you configure Renovate entirely on the bot side (i.e. empty `renovate.json` in repositories) and (b) you wish to run Renovate on every repository the bot has access to, and (c) you wish to skip the onboarding PRs.

## onboardingConfig

## password

## platform

## prFooter

## printConfig

This option is useful for troubleshooting, particularly if using presets. e.g. run `renovate foo/bar --print-config > config.log` and the fully-resolved config will be included in the log file.

## privateKey

## repositories

## requireConfig

## skipInstalls

By default, Renovate will use the most efficient approach to updating package files and lock files, which in most cases skips the need to perform a full module install by the bot. If this is set to false, then a full install of modules will be done. This is currently applicable to `npm` and `lerna`/`npm` only, and only used in cases where bugs in `npm` result in incorrect lock files being updated.

## token

## trustLevel

Setting trustLevel to "high" can make sense in many self-hosted cases where the bot operator trusts the content in each repository.

Setting trustLevel=high means:

- Child processes are run with full access to `env`
- `.npmrc` files can have environment variable substitution performed

## username
