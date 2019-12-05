---
title: Self-Hosted Configuration
description: Self-Hosted Configuration usable in renovate.json or package.json
---

# Self-Hosted Configuration Options

The below configuration options are applicable only if you are running your own instance ("bot") of Renovate.

## autodiscover

Be cautious when using this option - it will run Renovate over _every_ repository that the bot account has access to. To filter this list, use `autodiscoverFilter`.

## autodiscoverFilter

A [minimatch](https://www.npmjs.com/package/minimatch) glob-style pattern for filtering `autodiscover`ed repositories. Ex: `project/*`

## baseDir

Configure this directory if you want to change which directory Renovate uses for storing data. If left unconfigured, it will typically be a temporary directory like `/tmp/renovate/`.

## binarySource

Set this to `global` if you wish Renovate to use globally-installed binaries (`npm`, `yarn`, etc) instead of using its bundled versions.
Set this to `docker` instead to use docker-based binaries.

## cacheDir

Configure this directory if you want to change which directory Renovate uses for storing cache data. If left unconfigured, it will typically be a temporary directory like `/tmp/renovate/cache/`. If you configure this to be different to the `baseDir`, it means you can have one location for repo data and another for cache data.

## dockerMapDotfiles

This is used if you want to map "dotfiles" from your host computer home directory to containers that Renovate creates, e.g. for updating lock files. Currently applicable to `.npmrc` only.

## dockerUser

Override default user and group used by docker-based binaries. UID and GID should match the user that executes renovate. See [Docker run reference](https://docs.docker.com/engine/reference/run/#user) for more information on user and group syntax.
Set this to `1001:1002` to use UID 1001 and GID 1002.

## dryRun

## endpoint

## force

This object is used as a "force override" when you need to make sure certain configuration overrides whatever is configured in the repository. For example, forcing a null (no) schedule to make sure Renovate raises PRs on a run even if the repository itself or its preset defines a schedule that's currently in active.

In practice, it is implemented by converting the `force` configuration into a `packageRule` that matches all packages.

## forceCli

This is set to true by default, meaning that any settings (such as `schedule`) take maximum priority even against custom settings existing inside individual repositories. It will also override any settings in `packageRules`.

## forkMode

You probably have no need for this option - it is an experimental setting for the Renovate hosted GitHub App.

## gitAuthor

RFC5322-compliant string if you wish to customise the git author for commits.

## gitPrivateKey

## logFile

## logFileLevel

## logLevel

## onboarding

Set this to `false` if (a) you configure Renovate entirely on the bot side (i.e. empty `renovate.json` in repositories) and (b) you wish to run Renovate on every repository the bot has access to, and (c) you wish to skip the onboarding PRs.

## onboardingBranch

Note that this setting is independent of `branchPrefix`. For example, if you configure `branchPrefix` to be `renovate-` then you'd still have the onboarding PR created with branch `renovate/configure` until you configure `onboardingBranch=renovate-configure` or similar. If you have an existing Renovate installation and you change `onboardingBranch` then it's possible that you'll get onboarding PRs for repositories that had previously closed the onboarding PR unmerged.

## onboardingConfig

## onboardingPrTitle

Similarly to `onboardingBranch`, if you have an existing Renovate installation and you change `onboardingPrTitle` then it's possible that you'll get onboarding PRs for repositories that had previously closed the onboarding PR unmerged.

## optimizeForDisabled

## password

## persistRepoData

Set this to true if you wish for Renovate to persist repo data between runs. The intention is that this allows Renovate to do a faster `git fetch` between runs rather than `git clone`. It also may mean that ignored directories like `node_modules` can be preserved and save time on operations like `npm install`.

## platform

## prCommitsPerRunLimit

Parameter to reduce CI load. CI jobs are usually triggered by these events: pull-request creation, pull-request update, automerge events. Set as an integer. Default is no limit.

## prFooter

## printConfig

This option is useful for troubleshooting, particularly if using presets. e.g. run `renovate foo/bar --print-config > config.log` and the fully-resolved config will be included in the log file.

## privateKey

## productLinks

Override this object if you wish to change the URLs that Renovate links to, e.g. if you have an internal forum for asking for help.

## repositories

## requireConfig

## skipInstalls

By default, Renovate will use the most efficient approach to updating package files and lock files, which in most cases skips the need to perform a full module install by the bot. If this is set to false, then a full install of modules will be done. This is currently applicable to `npm` and `lerna`/`npm` only, and only used in cases where bugs in `npm` result in incorrect lock files being updated.

## token

## trustLevel

Setting trustLevel to `"high"` can make sense in many self-hosted cases where the bot operator trusts the content in each repository.

Setting trustLevel=high means:

- Child processes are run with full access to `env`
- `.npmrc` files can have environment variable substitution performed

## username
