---
title: Self-Hosted configuration
description: Self-Hosted configuration usable in config file, CLI or environment variables
---

# Self-Hosted configuration options

The configuration options listed in this document are applicable to self-hosted instances of Renovate ("the bot").

Please also see [Self-Hosted Experimental Options](./self-hosted-experimental.md).

## allowCustomCrateRegistries

## allowPostUpgradeCommandTemplating

Set to true to allow templating of dependency level post-upgrade commands.

Let's look at an example of configuring packages with existing Angular migrations.

Add two properties to `config.js`: `allowPostUpgradeCommandTemplating` and `allowedPostUpgradeCommands`:

```javascript
module.exports = {
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
      "matchPackageNames": ["@angular/core"],
      "postUpgradeTasks": {
        "commands": [
          "npm ci --ignore-scripts",
          "npx ng update {{{depName}}} --from={{{currentVersion}}} --to={{{newVersion}}} --migrate-only --allow-dirty --force"
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
npx ng update @angular/core --from=10.0.0 --to=11.0.0 --migrate-only --allow-dirty --force
```

## allowScripts

## allowedPostUpgradeCommands

A list of regular expressions that determine which commands in `postUpgradeTasks` are allowed to be executed.
If this list is empty then no tasks will be executed.

e.g.

```json
{
  "allowedPostUpgradeCommands": ["^tslint --fix$", "^tslint --[a-z]+$"]
}
```

## autodiscover

When you enable `autodiscover`, by default, Renovate will run on _every_ repository that the bot account can access.
If you want Renovate to run on only a subset of those, use the `autodiscoverFilter` option to limit the bot to only the wanted repositories.

## autodiscoverFilter

You can use this option to filter the list of repositories that the Renovate bot account can access through `autodiscover`.
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

Renovate often needs to use third party binaries in its PRs, e.g. `npm` to update `package-lock.json` or `go` to update `go.sum`.
By default, Renovate will use a child process to run such tools, so they need to be pre-installed before running Renovate and available in the path.

As an alternative, Renovate can use "sidecar" containers for third party tools.
If configured, Renovate will use `docker run` to create containers such as Node.js or Python to run tools within as-needed.
For this to work, `docker` needs to be installed and the Docker socket available to Renovate.

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

Set to `false` to prevent usage of `--ignore-platform-reqs` in the Composer package manager.s

## customEnvVariables

This configuration will be applied after all other environment variables so that it can be used to override defaults.

## dockerChildPrefix

Adds a custom prefix to the default Renovate sidecar Docker containers name and label.

If this is set to `myprefix_` the final image name for `renovate/node` would be named `myprefix_node` instead of currently used `renovate_node` and be labeled `myprefix_child` instead of `renovate_child`.

Note that dangling containers will not be removed until Renovate is run with the same prefix again.

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

## endpoint

## exposeAllEnv

By default, Renovate only passes a limited set of environment variables to package managers.
Confidential data can be leaked if a malicious script enumerates all environment variables.
Set `exposeAllEnv` to `true` only if you have reviewed (and trust) the repositories which Renovate bot runs against.

Setting this to `true` will also allow for variable substitution in `.npmrc` files.

## force

This object is used as a "force override" when you need to make sure certain configuration overrides whatever is configured in the repository.
For example, forcing a null (no) schedule to make sure Renovate raises PRs on a run even if the repository itself or its preset defines a schedule that's currently inactive.

In practice, it is implemented by converting the `force` configuration into a `packageRule` that matches all packages.

## forceCli

This is set to true by default, meaning that any settings (such as `schedule`) take maximum priority even against custom settings existing inside individual repositories.
It will also override any settings in `packageRules`.

## forkMode

You probably have no need for this option - it is an experimental setting for the Renovate hosted GitHub App.

## gitAuthor

You can customize the Git author that's used whenever Renovate creates a commit.
The `gitAuthor` option accepts a RFC5322-compliant string.

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

## logFileLevel

## onboarding

Set this to `false` only if all three statements are true:

- You've configured Renovate entirely on the bot side (e.g. empty `renovate.json` in repositories)
- You want to run Renovate on every repository the bot has access to
- You want to skip all onboarding PRs

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

Set this to true if you want Renovate to persist repo data between runs.
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

To create the key pair with OpenSSL use the following commands:

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

## secrets

Secrets may be configured by a bot admin in `config.js`, which will then make them available for templating within repository configs.
For example, to configure a `GOOGLE_TOKEN` to be accessible by all repositories:

```js
module.exports = {
  secrets: {
    GOOGLE_TOKEN: 'abc123',
  },
};
```

They can also be configured per repository, e.g.

```js
module.exports = {
  repositories: [
    {
      repository: 'abc/def',
      secrets: {
        GOOGLE_TOKEN: 'abc123',
      },
    },
  ],
};
```

It could then be used in a repository config or preset like so:

```json
{
  "hostRules": [
    {
      "domainName": "google.com",
      "token": "{{ secrets.GOOGLE_TOKEN }}"
    }
  ]
}
```

Secret names must start with a upper or lower case character and can contain only characters, digits, or underscores.

## skipInstalls

By default, Renovate will use the most efficient approach to updating package files and lock files, which in most cases skips the need to perform a full module install by the bot.
If this is set to false, then a full install of modules will be done.
This is currently applicable to `npm` and `lerna`/`npm` only, and only used in cases where bugs in `npm` result in incorrect lock files being updated.

## token

## username
