---
title: Self-Hosted Configuration
description: Self-Hosted Configuration usable in renovate.json or package.json
---

# Self-Hosted Configuration Options

The below configuration options are applicable only if you are running your own instance ("bot") of Renovate.

## allowPostUpgradeCommandTemplating

If true allow templating for post-upgrade commands on dependency level pust upgrade commands.

Let's look at an example of configuring packages with existing Angular migrations.

Add two properties to `config.js`: `allowPostUpgradeCommandTemplating` and `allowedPostUpgradeCommands`

```javascript
module.exports = {
  allowPostUpgradeCommandTemplating: true,
  allowedPostUpgradeCommands: ['^npm ci --ignore-scripts$', '^npx ng update'],
};
```

In the `renovate.json` file, define the commands and files to be included in the final commit.

The command to install dependencies is necessary because, by default, the installation of dependencies is skipped (see the `skipInstalls` admin option)

```json
{
  "packageRules": [
    {
      "matchPackageNames": ["@angular/core"],
      "postUpgradeTasks": {
        "commands": [
          "npm ci --ignore-scripts",
          "npx ng update {{{depName}}} --from={{{currentVersion}}} --to={{{newVersion}}} --migrateOnly --allowDirty --force"
        ],
        "fileFilters": ["**/**"]
      }
    }
  ]
}
```

With this configuration, the executable command for `@angular/core` will look like this

```bash
npm ci --ignore-scripts
npx ng update @angular/core --from=9.0.0 --to=10.0.0 --migrateOnly --allowDirty --force
```

## allowedPostUpgradeCommands

A list of regular expressions that determine which commands in `postUpgradeTasks` are allowed to be executed.
If this list is empty then no tasks will be executed.
Also you need to have `"trustLevel": "high"`, otherwise these tasks will be ignored.

e.g.

```json
{
  "allowedPostUpgradeCommands": ["^tslint --fix$", "^tslint --[a-z]+$"],
  "trustLevel": "high"
}
```

## autodiscover

Be cautious when using this option - it will run Renovate over _every_ repository that the bot account has access to.
To filter this list, use `autodiscoverFilter`.

## autodiscoverFilter

A [minimatch](https://www.npmjs.com/package/minimatch) glob-style pattern for filtering `autodiscover`ed repositories. Ex: `project/*`

## baseDir

Configure this directory if you want to change which directory Renovate uses for storing data.
If left unconfigured, it will typically be a temporary directory like `/tmp/renovate/`.

## binarySource

Set this to `global` if you wish Renovate to use globally-installed binaries (`npm`, `yarn`, etc) instead of using its bundled versions.
Set this to `docker` instead to use Docker-based binaries.

## cacheDir

Configure this directory if you want to change which directory Renovate uses for storing cache data.
If left unconfigured, it will typically be a temporary directory like `/tmp/renovate/cache/`.
If you configure this to be different to the `baseDir`, it means you can have one location for repo data and another for cache data.

## composerIgnorePlatformReqs

Set to `false` to prevent usage of `--ignore-platform-reqs` in the Composer package manager.

## customEnvVariables

This configuration will be applied after all other environment variables so that it can be used to override defaults.

## dockerImagePrefix

Override the default renovate sidecar Docker containers image prefix from `docker.io/renovate` to a custom value, so renovate will pull images from a custom Docker registry.

If this is set to `ghcr.io/renovatebot` the final image for `node` would become `ghcr.io/renovatebot/node` instead of currently used `docker.io/renovate/node`.

## dockerMapDotfiles

This is used if you want to map "dotfiles" from your host computer home directory to containers that Renovate creates, e.g. for updating lock files.
Currently applicable to `.npmrc` only.

## dockerUser

Override default user and group used by Docker-based binaries.
UID and GID should match the user that executes renovate.
See [Docker run reference](https://docs.docker.com/engine/reference/run/#user) for more information on user and group syntax.
Set this to `1001:1002` to use UID 1001 and GID 1002.

## dryRun

## endpoint

## force

This object is used as a "force override" when you need to make sure certain configuration overrides whatever is configured in the repository.
For example, forcing a null (no) schedule to make sure Renovate raises PRs on a run even if the repository itself or its preset defines a schedule that's currently in active.

In practice, it is implemented by converting the `force` configuration into a `packageRule` that matches all packages.

## forceCli

This is set to true by default, meaning that any settings (such as `schedule`) take maximum priority even against custom settings existing inside individual repositories.
It will also override any settings in `packageRules`.

## forkMode

You probably have no need for this option - it is an experimental setting for the Renovate hosted GitHub App.

## gitAuthor

RFC5322-compliant string if you wish to customise the Git author for commits.
If you need to transition from one Git author to another, put the old gitAuthor into `RENOVATE_LEGACY_GIT_AUTHOR_EMAIL` in environment.
Renovate will then check against it as well as the current Git author value before deciding if a branch has been modified.

**Note** It is strongly recommended that the Git author email you provide should be unique to Renovate.
Otherwise, if another bot or human shares the same email and pushes to one of Renovate's branches then Renovate will mistake the branch as unmodified and potentially force push over the changes.

## gitPrivateKey

This should be an armored private key, e.g. the type you get from running `gpg --export-secret-keys --armor 92066A17F0D1707B4E96863955FEF5171C45FAE5 > private.key`.
Replace the newlines with `\n` before adding the resulting single-line value to your bot's config.

It will be loaded _lazily_.
Before the first commit in a repository, Renovate will:

- First, run `gpg import` if it hasn't been run before
- Then, run `git config user.signingkey` and `git config commit.gpgsign true`

The `git` commands are run locally in the cloned repo instead of globally to reduce the chance of causing unintended consequences with global Git configs on shared systems.

## logContext

`logContext` is included with each log entry only if `logFormat="json"` - it is not included in the pretty log output.
If left as default (null), a random short ID will be selected.

## logFile

## logFileLevel

## logLevel

It's recommended to run at debug level if you can, and configure it using the environment variable `LOG_LEVEL=debug`.
By configuring using the environment it means that debug logging starts from the beginning of the app, while if you configure it using file config then the debug logging can only start after the file config is parsed.

Additionally, if you configure `LOG_FORMAT=json` in env then logging will be done in JSON format instead of "pretty" format, which is usually better if you're doing any ingestion or parsing of the logs.

Warning: Configuring `logLevel` config option or `--log-level` cli option is deprecated and will be removed in a major version.

## onboarding

Set this to `false` if (a) you configure Renovate entirely on the bot side (i.e. empty `renovate.json` in repositories) and (b) you wish to run Renovate on every repository the bot has access to, and (c) you wish to skip the onboarding PRs.

## onboardingBranch

Note that this setting is independent of `branchPrefix`.
For example, if you configure `branchPrefix` to be `renovate-` then you'd still have the onboarding PR created with branch `renovate/configure` until you configure `onboardingBranch=renovate-configure` or similar.
If you have an existing Renovate installation and you change `onboardingBranch` then it's possible that you'll get onboarding PRs for repositories that had previously closed the onboarding PR unmerged.

## onboardingCommitMessage

Note that if `commitMessagePrefix` or `semanticCommits` values are defined then they will be prepended to the commit message using the same logic that is used for adding them to non-onboarding commit messages.

## onboardingConfig

## onboardingConfigFileName

If set to one of the valid [config file names](https://docs.renovatebot.com/configuration-options/), the onboarding PR will create a configuration file with the provided name instead of `renovate.json`.
Falls back to `renovate.json` if the name provided is not valid.

## onboardingPrTitle

Similarly to `onboardingBranch`, if you have an existing Renovate installation and you change `onboardingPrTitle` then it's possible that you'll get onboarding PRs for repositories that had previously closed the onboarding PR unmerged.

## optimizeForDisabled

## password

## persistRepoData

Set this to true if you wish for Renovate to persist repo data between runs.
The intention is that this allows Renovate to do a faster `git fetch` between runs rather than `git clone`.
It also may mean that ignored directories like `node_modules` can be preserved and save time on operations like `npm install`.

## platform

## prCommitsPerRunLimit

Parameter to reduce CI load.
CI jobs are usually triggered by these events: pull-request creation, pull-request update, automerge events.
Set as an integer.
Default is no limit.

## printConfig

This option is useful for troubleshooting, particularly if using presets.
e.g. run `renovate foo/bar --print-config > config.log` and the fully-resolved config will be included in the log file.

## privateKey

This private key is used to decrypt config files.

The corresponding public key can be used to create encrypted values for config files.
If you want a simple UI to encrypt values you can put the public key in a HTML page similar to <https://renovatebot.com/encrypt>.

To create the key pair with openssl use the following commands:

- `openssl genrsa -out rsa_priv.pem 4096` for generating the private key
- `openssl rsa -pubout -in rsa_priv.pem -out rsa_pub.pem` for extracting the public key

## privateKeyPath

Used as an alternative to `privateKey`, if you wish for the key to be read from disk instead.

## productLinks

Override this object if you wish to change the URLs that Renovate links to, e.g. if you have an internal forum for asking for help.

## redisUrl

If this value is set then Renovate will use Redis for its global cache instead of the local file system.
The global cache is used to store lookup results (e.g. dependency versions and release notes) between repositories and runs.
Example url: `redis://localhost`.

## repositories

## repositoryCache

Set this to `"enabled"` to have Renovate maintain a JSON file cache per-repository to speed up extractions.
Set to `"reset"` if you ever need to bypass the cache and have it overwritten.
JSON files will be stored inside the `cacheDir` beside the existing file-based package cache.

Warning: this is an experimental feature and may be modified or removed in a future non-major release.

## requireConfig

## skipInstalls

By default, Renovate will use the most efficient approach to updating package files and lock files, which in most cases skips the need to perform a full module install by the bot.
If this is set to false, then a full install of modules will be done.
This is currently applicable to `npm` and `lerna`/`npm` only, and only used in cases where bugs in `npm` result in incorrect lock files being updated.

## token

## trustLevel

Setting trustLevel to `"high"` can make sense in many self-hosted cases where the bot operator trusts the content in each repository.

Setting trustLevel=high means:

- Child processes are run with full access to `env`
- `.npmrc` files can have environment variable substitution performed

## username
