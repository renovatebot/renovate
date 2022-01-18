---
title: Self-Hosted configuration
description: Self-Hosted configuration usable in config file, CLI or environment variables
---

# Self-Hosted configuration options

The configuration options listed in this document are applicable to self-hosted instances of Renovate ("the bot").

Please also see [Self-Hosted Experimental Options](./self-hosted-experimental.md).

## allowCustomCrateRegistries

## allowPlugins

## allowPostUpgradeCommandTemplating

Set to `true` to allow templating of dependency level post-upgrade commands.

Let's look at an example of configuring packages with existing Angular migrations.

Add two properties to `config.js`: `allowPostUpgradeCommandTemplating` and `allowedPostUpgradeCommands`:

```javascript
module.exports = {
  allowPostUpgradeCommandTemplating: true,
  allowedPostUpgradeCommands: ['^npm ci --ignore-scripts$', '^npx ng update'],
};
```

In the `renovate.json` file, define the commands and files to be included in the final commit.

The command to install dependencies (`npm ci --ignore-scripts`) is necessary because, by default, the installation of dependencies is skipped (see the `skipInstalls` global option).

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
It takes a [minimatch](https://www.npmjs.com/package/minimatch) glob-style or regex pattern.

**Minimatch**:

```json
{
  "autodiscoverFilter": "project/*"
}
```

**Regex**:

All text inside the start and end `/` will be treated as a regular expression.

```json
{
  "autodiscoverFilter": "/project/.*/"
}
```

You can negate the regex by putting a `!` in front:

```json
{
  "autodiscoverFilter": "!/project/.*/"
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

Renovate often needs to use third-party binaries in its PRs, e.g. `npm` to update `package-lock.json` or `go` to update `go.sum`.
By default, Renovate will use a child process to run such tools, so they need to be pre-installed before running Renovate and available in the path.

Renovate can instead use "sidecar" containers for third-party tools when `binarySource=docker`.
If configured, Renovate will use `docker run` to create containers such as Node.js or Python to run tools within as-needed.
For this to work, `docker` needs to be installed and the Docker socket available to Renovate.

Additionally, when Renovate is run inside a container built using [`containerbase/buildpack`](https://github.com/containerbase/buildpack), such as the official Renovate images on Docker Hub, then `binarySource=install` can be used.
This mode means that Renovate will dynamically install the version of tools available, if supported.

Supported tools for dynamic install are:

- `composer`
- `jb`
- `npm`

Unsupported tools will fall back to `binarySource=global`.

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

## customEnvVariables

This configuration will be applied after all other environment variables so that it can be used to override defaults.

## detectGlobalManagerConfig

The purpose of this capability is to allow a bot admin to configure manager-specific files such as a global `.npmrc` file, instead of configuring it in Renovate config.

This feature is disabled by default because it may prove surprising or undesirable for some users who don't expect Renovate to go into their home directory and import registry or credential information.

Currently this capability is supported for the `npm` manager only - specifically the `~/.npmrc` file.
If found, it will be imported into `config.npmrc` with `config.npmrcMerge` will be set to `true`.

## detectHostRulesFromEnv

The format of the environment variables must follow:

- Datasource name (e.g. `NPM`, `PYPI`)
- Underscore (`_`)
- `matchHost`
- Underscore (`_`)
- Field name (`TOKEN`, `USER_NAME`, or `PASSWORD`)

Hyphens (`-`) in datasource or host name must be replaced with double underscores (`__`).
Periods (`.`) in host names must be replaced with a single underscore (`_`).

Note: the following prefixes cannot be supported for this functionality: `npm_config_`, `npm_lifecycle_`, `npm_package_`.

### npmjs registry token example

`NPM_REGISTRY_NPMJS_ORG_TOKEN=abc123`:

```json
{
  "hostRules": [
    {
      "hostType": "npm",
      "matchHost": "registry.npmjs.org",
      "token": "abc123"
    }
  ]
}
```

### GitLab Tags username/password example

`GITLAB__TAGS_CODE__HOST_COMPANY_COM_USERNAME=bot GITLAB__TAGS_CODE__HOST_COMPANY_COM_PASSWORD=botpass123`:

```json
{
  "hostRules": [
    {
      "hostType": "gitlab-tags",
      "matchHost": "code-host.company.com",
      "username": "bot",
      "password": "botpass123"
    }
  ]
}
```

### Datasource and credentials only

You can skip the host part, and use just the datasource and credentials.

`DOCKER_USERNAME=bot DOCKER_PASSWORD=botpass123`:

```json
{
  "hostRules": [
    {
      "hostType": "docker",
      "username": "bot",
      "password": "botpass123"
    }
  ]
}
```

## dockerChildPrefix

Adds a custom prefix to the default Renovate sidecar Docker containers name and label.

If this is set to `myprefix_` the final container created from `renovate/node` image would be named `myprefix_node` instead of currently used `renovate_node` and be labeled `myprefix_child` instead of `renovate_child`.

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

## executionTimeout

Default execution timeout in minutes for child processes Renovate creates.
If this option is not set, Renovate will fallback to 15 minutes.

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
If this is set to `true` then Renovate will fork the repository into the personal space of the person owning the Personal Access Token.

## forkToken

You probably have no need for this option - it is an experimental setting for the Renovate hosted GitHub App.
This should be set to a Personal Access Token (GitHub only) when `forkMode` is set to `true`.
Renovate will use this token to fork the repository into the personal space of the person owning the Personal Access Token.
Renovate will then create branches on the fork and opens Pull Requests on the parent repository.

## gitNoVerify

Controls when Renovate passes the `--no-verify` flag to `git`.
The flag can be passed to `git commit` and/or `git push`.
Read the documentation for [git commit --no-verify](https://git-scm.com/docs/git-commit#Documentation/git-commit.txt---no-verify) and [git push --no-verify](https://git-scm.com/docs/git-push#Documentation/git-push.txt---no-verify) to learn exactly what each flag does.
To learn more about Git hooks, read the [Pro Git 2 book, section on Git Hooks](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks).

## gitPrivateKey

This should be an armored private key, e.g. the type you get from running `gpg --export-secret-keys --armor 92066A17F0D1707B4E96863955FEF5171C45FAE5 > private.key`.
Replace the newlines with `\n` before adding the resulting single-line value to your bot's config.

It will be loaded _lazily_.
Before the first commit in a repository, Renovate will:

1. Run `gpg import` (if it hasn't been run before)
1. Run `git config user.signingkey` and `git config commit.gpgsign true`

The `git` commands are run locally in the cloned repo instead of globally.
This reduces the chance of unintended consequences with global Git configs on shared systems.

## gitUrl

Override the default resolution for Git remote, e.g. to switch GitLab from HTTPS to SSH-based.
Currently works for GitLab only.

Possible values:

- `default`: use HTTPS URLs provided by the platform for Git
- `ssh`: use SSH URLs provided by the platform for Git
- `endpoint`: ignore URLs provided by the platform and use the configured endpoint directly

## logContext

`logContext` is included with each log entry only if `logFormat="json"` - it is not included in the pretty log output.
If left as default (null), a random short ID will be selected.

## logFile

## logFileLevel

## migratePresets

Use this if you have repositories that extend from a particular preset, which has now been renamed or removed.
This is handy if you have a large number of repositories that all extend from a particular preset which you want to rename, without the hassle of manually updating every repository individually.
Use an empty string to indicate that the preset should be ignored rather than replaced.

Example:

```js
modules.exports = {
  migratePresets: {
    '@company': 'local>org/renovate-config',
  },
};
```

In the above example any reference to the `@company` preset will be replaced with `local>org/renovate-config`.

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

## onboardingNoDeps

Set this to true if you want Renovate to create an onboarding PR even if no dependencies are found.
Otherwise, Renovate skips onboarding a repository if it finds no dependencies in it.

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
If you want a simple UI to encrypt values you can put the public key in a HTML page similar to <https://app.renovatebot.com/encrypt>.

To create the key pair with GPG use the following commands:

- `gpg --full-generate-key` and follow the prompts to generate a key. Name and email are not important to Renovate, and do not configure a passphrase. Use a 4096bit key.

<details><summary>key generation log</summary>

```
❯ gpg --full-generate-key
gpg (GnuPG) 2.2.24; Copyright (C) 2020 Free Software Foundation, Inc.
This is free software: you are free to change and redistribute it.
There is NO WARRANTY, to the extent permitted by law.

Please select what kind of key you want:
   (1) RSA and RSA (default)
   (2) DSA and Elgamal
   (3) DSA (sign only)
   (4) RSA (sign only)
  (14) Existing key from card
Your selection? 1
RSA keys may be between 1024 and 4096 bits long.
What keysize do you want? (3072) 4096
Requested keysize is 4096 bits
Please specify how long the key should be valid.
         0 = key does not expire
      <n>  = key expires in n days
      <n>w = key expires in n weeks
      <n>m = key expires in n months
      <n>y = key expires in n years
Key is valid for? (0)
Key does not expire at all
Is this correct? (y/N) y

GnuPG needs to construct a user ID to identify your key.

Real name: Renovate Bot
Email address: renovate@whitesourcesoftware.com
Comment:
You selected this USER-ID:
    "Renovate Bot <renovate@whitesourcesoftware.com>"

Change (N)ame, (C)omment, (E)mail or (O)kay/(Q)uit? O

gpg: key 0649CC3899F22A66 marked as ultimately trusted
gpg: revocation certificate stored as '/Users/rhys/.gnupg/openpgp-revocs.d/794B820F34B34A8DF32AADB20649CC3899F22A66.rev'
public and secret key created and signed.

pub   rsa4096 2021-09-10 [SC]
      794B820F34B34A8DF32AADB20649CEXAMPLEONLY
uid                      Renovate Bot <renovate@whitesourcesoftware.com>
sub   rsa4096 2021-09-10 [E]
```

</details>

- Copy the key ID from the output (`794B820F34B34A8DF32AADB20649CEXAMPLEONLY` in the above example) or run `gpg --list-secret-keys` if you forgot to take a copy
- Run `gpg --armor --export-secret-keys YOUR_NEW_KEY_ID > renovate-private-key.asc` to generate an armored (text-based) private key file
- Run `gpg --armor --export YOUR_NEW_KEY_ID > renovate-public-key.asc` to generate an armored (text-based) public key file

The private key should then be added to your Renovate Bot global config (either using `privateKeyPath` or exporting it to the `RENOVATE_PRIVATE_KEY` environment variable).
The public key can be used to replace the existing key in <https://app.renovatebot.com/encrypt> for your own use.

Any encrypted secrets using GPG must have a mandatory organization/group scope, and optionally can be scoped for a single repository only.
The reason for this is to avoid "replay" attacks where someone could learn your encrypted secret and then reuse it in their own Renovate repositories.
Instead, with scoped secrets it means that Renovate ensures that the organization and optionally repository values encrypted with the secret match against the running repository.

Note: simple public key encryption was previously used to encrypt secrets, but this approach has now been deprecated and no longer documented.

## privateKeyOld

Use this field if you need to perform a "key rotation" and support more than one keypair at a time.
Decryption with this key will be attempted after `privateKey`.

If you are migrating from the legacy public key encryption approach to use GPG, then move your legacy private key from `privateKey` to `privateKeyOld` and then put your new GPG private key in `privateKey`.
Doing so will mean that Renovate will first attempt to decrypt using the GPG key but fall back to the legacy key and try that next.

You can remove the `privateKeyOld` config option once all the old encrypted values have been migrated, or if you no longer want to support the old key and let the processing of repositories fail.

## privateKeyPath

Used as an alternative to `privateKey`, if you want the key to be read from disk instead.

## privateKeyPathOld

Used as an alternative to `privateKeyOld`, if you want the key to be read from disk instead.

## productLinks

Override this object if you want to change the URLs that Renovate links to, e.g. if you have an internal forum for asking for help.

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

If this is set to `false`, it means that Renovate won't require a config file such as `renovate.json` to be present in each repository and will run even if one is missing.

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
      "matchHost": "google.com",
      "token": "{{ secrets.GOOGLE_TOKEN }}"
    }
  ]
}
```

Secret names must start with an upper or lower case character and can contain only characters, digits, or underscores.

## skipInstalls

By default, Renovate will use the most efficient approach to updating package files and lock files, which in most cases skips the need to perform a full module install by the bot.
If this is set to false, then a full install of modules will be done.
This is currently applicable to `npm` and `lerna`/`npm` only, and only used in cases where bugs in `npm` result in incorrect lock files being updated.

## token

## username

Mandatory if a GitHub app token is in use using the CLI.

## writeDiscoveredRepos

Optional parameter which allows to write the discovered repositories into a JSON file instead of renovating them.

Usage: `renovate --write-discovered-repos=/tmp/renovate-repos.json`

```json
["myOrg/myRepo", "myOrg/anotherRepo"]
```
