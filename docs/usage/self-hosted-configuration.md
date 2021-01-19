---
title: Self-Hosted configuration
description: Self-Hosted configuration usable in renovate.json or package.json
---

# Self-Hosted configuration options

The configuration options listed in this document are applicable to self-hosted instances of Renovate ("the bot").

## allowPostUpgradeCommandTemplating

Set to true to allow templating of post-upgrade commands.

Let's look at an example of configuring packages with existing Angular migrations.

Add two properties to `config.js`: `allowPostUpgradeCommandTemplating` and `allowedPostUpgradeCommands`:

```javascript
module.export = {
  allowPostUpgradeCommandTemplating: true,
  allowedPostUpgradeCommands: ['^npm ci --ignore-scripts$', '^npx ng update'],
};
```

In the `renovate.json` file, define the commands and files to be included in the final commit.
The command to install dependencies (`npm ci --ignore-scripts`) is necessary because, by default, the installation of dependencies is skipped (see the `skipInstalls` admin option).

```json
{
  "packageRules": [
    {
      "packageNames": ["@angular/core"],
      "postUpgradeTasks": {
        "commands": [
          "npm ci --ignore-scripts",
          "npx ng update {{{depName}}} --from={{{fromVersion}}} --to={{{toVersion}}} --migrateOnly --allowDirty --force"
        ],
        "fileFilters": ["**/**"]
      }
    }
  ]
}
```

With this configuration, the executable command for `@angular/core` looks like this:

```bash
npm ci --ignore-scripts
npx ng update @angular/core --from=9.0.0 --to=10.0.0 --migrateOnly --allowDirty --force
```

## allowedPostUpgradeCommands

A list of regular expressions that determine which commands in `postUpgradeTasks` are allowed to be executed.
If the list is empty no tasks will be executed.

e.g.

```json
{
  "allowedPostUpgradeCommands": ["^tslint --fix$", "^tslint --[a-z]+$"]
}
```

## autodiscover

When you enable `autodiscover`, by default, Renovate will run on _every_ repository that the bot account can access.
This is probably not what you want.
Use the `autodiscoverFilter` option to limit the bot to only the wanted repositories.

## autodiscoverFilter

You can use this option to filter the list of repositories that the Renovate bot account can access trough `autodiscover`.
It takes a [minimatch](https://www.npmjs.com/package/minimatch) glob-style pattern.

e.g.

```json
{
  "autodiscoverFilter": "project/*"
}
```

## baseDir

By default Renovate uses a temporary directory like `/tmp/renovate` to store its data.
You can override this default with the `baseDir` option.

e.g.

```json
{
  "baseDir": "/my-own-different-temporary-folder"
}
```

## binarySource

By default Renovate uses the binaries that are bundled with the Renovate bot.
Use the `binarySource` option to override this default.
You can use globally installed binaries, or Docker-based binaries.

To use your globally installed binaries (`npm`, `yarn`, etc):

```json
{
  "binarySource": "global"
}
```

To use Docker-based binaries:

```json
{
  "binarySource": "docker"
}
```

## cacheDir

By default Renovate uses a temporary directory like `/tmp/renovate/cache` to store cache data.
Use the `cacheDir` option to override this default.

The `baseDir` and `cacheDir` option do not need to point to the same directory.
You can use one directory for the repo data, and another for the the cache data.

e.g.

```json
{
  "baseDir": "/my-own-different-temporary-folder",
  "cacheDir": "/my-own-different-cache-folder"
}
```

## composerIgnorePlatformReqs

Set to `false` to prevent usage of `--ignore-platform-reqs` in the Composer package manager.

e.g.

```json
{
  "composerIgnorePlatformReqs": false
}
```

## customEnvVariables

This configuration will be applied after all other environment variables so that it can be used to override defaults.

## dockerImagePrefix

By default Renovate pulls the sidecar Docker containers from `docker.io/renovate`.
You can use the `dockerImagePrefix` option to override this default.

Say you want to pull your images from `ghcr.io/renovatebot` instead of `docker.io/renovate`.
You would use put this in your configuration file:

```json
{
  "dockerImagePrefix": "ghcr.io/renovatebot"
}
```

If you pulled a new `node` image, the final image would be `ghcr.io/renovatebot/node` instead of `docker.io/renovate/node`.

## dockerMapDotfiles

This is used if you want to map "dotfiles" from your host computer home directory to containers that Renovate creates, e.g. for updating lock files.
Currently applicable to `.npmrc` only.

```json
{
  "dockerMapDotfiles": true
}
```

## dockerUser

Override default user and group used by Docker-based binaries.
The user-id (UID) and group-id (GID) should match the user that executes Renovate.

Read the [Docker run reference](https://docs.docker.com/engine/reference/run/#user) for more information on user and group syntax.
Set this to `1001:1002` to use UID 1001 and GID 1002.
e.g.

```json
{
  "dockerUser": "1001:1002"
}
```

## dryRun

TODO: Describe the `dryRun` option.
TODO: Add JSON example.

## endpoint

TODO: Describe the `endpoint` option.
TODO: Add JSON example.

## force

This object is used as a "force override" when you need to make sure certain configuration overrides whatever is configured in the repository.
For example, forcing a null (no) schedule to make sure Renovate raises PRs on a run even if the repository itself or its preset defines a schedule that's currently inactive.

In practice, it is implemented by converting the `force` configuration into a `packageRule` that matches all packages.

TODO: Add JSON example of using `force` with `packageRule` here.
TODO: Improve language used in this section, this is really hard to understand as-is.

## forceCli

This is set to true by default, meaning that any settings (such as `schedule`) take maximum priority even against custom settings existing inside individual repositories.
It will also override any settings in `packageRules`.

TODO: add clarification, I think we mean to say: "The CLI input will take precedence over everything else by default."
TODO: add JSON example here.

## forkMode

You probably have no need for this option - it is an experimental setting for the Renovate hosted GitHub App.

TODO: Is this still relevant? If this is such an experimental thing, why not warn users away more strongly?
TODO: Also what is `forkMode`? The section doesn't explain.

## gitAuthor

You can customize the Git author that's used whenever Renovate creates a commit.
The `gitAuthor` option accepts a RFC5322-compliant string.

TODO: add exaple of `gitAuthor` usage here.

If you are migrating from a old Git author to a new Git author, put the old `gitAuthor` into `RENOVATE_LEGACY_GIT_AUTHOR_EMAIL` in environment (TODO: Explain where/what is this "environment"???).
Renovate will then check for the old and current Git author before it decides if a branch has been modified.

**Note** We strongly recommend that the Git author email you use is unique to Renovate.
Otherwise, if another bot or human shares the same email and pushes to one of Renovate's branches then Renovate will mistake the branch as unmodified and potentially force push over the changes.

## gitPrivateKey

This should be an armored private key, e.g. the type you get from running `gpg --export-secret-keys --armor 92066A17F0D1707B4E96863955FEF5171C45FAE5 > private.key`.
Replace the newlines with `\n` before adding the resulting single-line value to your bot's config.

It will be loaded _lazily_.
Before the first commit in a repository, Renovate will:

1. Run `gpg import` (if it hasn't been run before)
1. Run `git config user.signingkey` and `git config commit.gpgsign true`

The `git` commands are run locally in the cloned repo instead of globally.
This reduces the chance of unintended consequences with global Git configs on shared systems.

## logContext

`logContext` is included with each log entry only if `logFormat="json"` - it is not included in the pretty log output.
If left as default (null), a random short ID will be selected.

## logFile

TODO: Explain what this is and how to use it.

## logFileLevel

TODO: Explain what this is and how to use it.

## logLevel

We recommend that you run the Renovate bot at the debug level if you can.
Use the environment variable `LOG_LEVEL=debug` to run Renovate at the debug level.

When you use `LOG_LEVEL=debug`, debug logging starts from the beginning of the app.
If you had configured debug logging in a file config, then the debug logging starts _after_ the file config is parsed.

Additionally, if you configure `LOG_FORMAT=json` in env then logging will be done in JSON format instead of "pretty" format, which is usually better if you're doing any ingestion or parsing of the logs.

## onboarding

Set this to `false` only if all three statements are true:

- You've configured Renovate entirely on the bot side (e.g. empty `renovate.json` in repositories)
- You want to run Renovate on every repository the bot has access to
- You want to skip all onboarding PRs

TODO: I think this is not really what we want to say here, is it? I've changed the sentence into a ordered list, to make clear what the old sentence actually said.

## onboardingBranch

Note that this setting is independent of `branchPrefix`.
For example, if you configure `branchPrefix` to be `renovate-` then you'd still have the onboarding PR created with branch `renovate/configure` until you configure `onboardingBranch=renovate-configure` or similar.
If you have an existing Renovate installation and you change `onboardingBranch` then it's possible that you'll get onboarding PRs for repositories that had previously closed the onboarding PR unmerged.

## onboardingCommitMessage

Note that if `commitMessagePrefix` or `semanticCommits` values are defined then they will be prepended to the commit message using the same logic that is used for adding them to non-onboarding commit messages.

## onboardingConfig

TODO: Explain `onboardingConfig`, add example of use.

## onboardingConfigFileName

If set to one of the valid [config file names](https://docs.renovatebot.com/configuration-options/), the onboarding PR will create a configuration file with the provided name instead of `renovate.json`.
Falls back to `renovate.json` if the name provided is not valid.

## onboardingPrTitle

Similarly to `onboardingBranch`, if you have an existing Renovate installation and you change `onboardingPrTitle` then it's possible that you'll get onboarding PRs for repositories that had previously closed the onboarding PR unmerged.

## optimizeForDisabled

TODO: Explain `optimizeForDisabled`, add example of use.

## password

TODO: Explain `password`, add example of use.

## persistRepoData

Set this to true if you wish for Renovate to persist repo data between runs.
The intention is that this allows Renovate to do a faster `git fetch` between runs rather than `git clone`.
It also may mean that ignored directories like `node_modules` can be preserved and save time on operations like `npm install`.

e.g.

```json
{
  "persistRepoData": true
}
```

## platform

TODO: Explain `platform`, add example of use.

## prCommitsPerRunLimit

Parameter to reduce CI load.
CI jobs are usually triggered by these events: pull-request creation, pull-request update, automerge events.
Set as an integer.
Default is no limit.

TODO: CHECK WHICH EXAMPLE IS CORRECT, EDIT IF NEEDED

e.g.

```json
{
  "prCommitsPerRunLimit": 2
}
```

OR:

```bash
renovate --prCommitsPerRunLimit=2
```

## printConfig

This option is useful for troubleshooting, particularly if using presets.
e.g. run `renovate foo/bar --print-config > config.log` and the fully-resolved config will be included in the log file.

## privateKey

This private key is used to decrypt config files.

The corresponding public key can be used to create encrypted values for config files.
If you want a simple UI to encrypt values you can put the public key in a HTML page similar to <https://renovatebot.com/encrypt>.

To create the key pair with OpenSSL use the following commands:

- `openssl genrsa -out rsa_priv.pem 4096` for generating the private key
- `openssl rsa -pubout -in rsa_priv.pem -out rsa_pub.pem` for extracting the public key

## privateKeyPath

Used as an alternative to `privateKey`, if you wish for the key to be read from disk instead.

TODO: add example of use.

## productLinks

Override this object if you wish to change the URLs that Renovate links to, e.g. if you have an internal forum for asking for help.

TODO: add example of use.

## redisUrl

If this value is set then Renovate will use Redis for its global cache instead of the local file system.
The global cache is used to store lookup results (e.g. dependency versions and release notes) between repositories and runs.
Example url: `redis://localhost`.

TODO: Add example use in JSON file???

## repositories

TODO: Explain `repositories`, add example of use.

## repositoryCache

Set this to `"enabled"` to have Renovate maintain a JSON file cache per-repository to speed up extractions.
Set to `"reset"` if you ever need to bypass the cache and have it overwritten.
JSON files will be stored inside the `cacheDir` beside the existing file-based package cache.

Warning: this is an experimental feature and may be modified or removed in a future non-major release.

TODO: Check if this feature is still present in the Renovate code.
TODO: Add example of use.
TODO: Warn users away more strongly if this is still experimental.

## requireConfig

TODO: Explain `requireConfig`, add example of use.

## skipInstalls

By default, Renovate will use the most efficient approach to updating package files and lock files, which in most cases skips the need to perform a full module install by the bot.
If this is set to false, then a full install of modules will be done.
This is currently applicable to `npm` and `lerna`/`npm` only, and only used in cases where bugs in `npm` result in incorrect lock files being updated.

TODO: add example of use, probably a JSON file with `"skipInstalls": true` in it?

## token

TODO: Explain `token`, add example of use.

## trustLevel

Setting trustLevel to `"high"` can make sense in many self-hosted cases where the bot operator trusts the content in each repository.

Setting trustLevel=high means:

- Child processes are run with full access to `env`
- `.npmrc` files can have environment variable substitution performed

TODO: add example of use.

## username

TODO: Explain `username`, add example of use.
