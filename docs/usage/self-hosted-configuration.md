---
title: Self-Hosted configuration
description: Self-Hosted configuration usable in config file, CLI or environment variables
---

# Self-Hosted configuration options

You can only use these configuration options when you're self-hosting Renovate.

Please also see [Self-Hosted Experimental Options](./self-hosted-experimental.md).

<!-- prettier-ignore -->
!!! note
    Config options with `type=string` are always non-mergeable, so `mergeable=false`.

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

The command to install dependencies (`npm ci --ignore-scripts`) is needed because, by default, the installation of dependencies is skipped (see the `skipInstalls` global option).

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

A list of regular expressions that decide which commands in `postUpgradeTasks` are allowed to run.
If this list is empty then no tasks will be executed.

For example:

```json
{
  "allowedPostUpgradeCommands": ["^tslint --fix$", "^tslint --[a-z]+$"]
}
```

## autodiscover

When you enable `autodiscover`, by default, Renovate runs on _every_ repository that the bot account can access.
You can limit which repositories Renovate can access by using the `autodiscoverFilter` config option.

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

For example:

```json
{
  "baseDir": "/my-own-different-temporary-folder"
}
```

## binarySource

Renovate often needs to use third-party binaries in its PRs, like `npm` to update `package-lock.json` or `go` to update `go.sum`.
By default, Renovate uses a child process to run such tools, so they must be:

- installed before running Renovate
- available in the path

But you can tell Renovate to use "sidecar" containers for third-party tools by setting `binarySource=docker`.
For this to work, `docker` needs to be installed and the Docker socket available to Renovate.
Now Renovate uses `docker run` to create containers like Node.js or Python to run tools in as-needed.

Additionally, when Renovate is run inside a container built using [`containerbase`](https://github.com/containerbase), such as the official Renovate images on Docker Hub, then `binarySource=install` can be used.
This mode means that Renovate will dynamically install the version of tools available, if supported.

Supported tools for dynamic install are:

- `bundler`
- `cargo`
- `composer`
- `flux`
- `gradle-wrapper`
- `jb`
- `jsonnet-bundler`
- `lerna`
- `mix`
- `node`
- `npm`
- `pip_requirements`
- `pip-compile`
- `pipenv`
- `pnpm`
- `poetry`
- `python`
- `yarn`

If all projects are managed by Hermit, you can tell Renovate to use the tooling versions specified in each project via Hermit by setting `binarySource=hermit`.

Tools not on this list fall back to `binarySource=global`.

## cacheDir

By default Renovate stores cache data in a temporary directory like `/tmp/renovate/cache`.
Use the `cacheDir` option to override this default.

The `baseDir` and `cacheDir` option may point to different directories.
You can use one directory for the repo data, and another for the cache data.

For example:

```json
{
  "baseDir": "/my-own-different-temporary-folder",
  "cacheDir": "/my-own-different-cache-folder"
}
```

## containerbaseDir

This directory is used to cache downloads when `binarySource=docker` or `binarySource=install`.

Use this option if you need such downloads to be stored outside of Renovate's regular cache directory (`cacheDir`).

## customEnvVariables

This configuration will be applied after all other environment variables so you can use it to override defaults.

## detectGlobalManagerConfig

The purpose of this config option is to allow you (as a bot admin) to configure manager-specific files such as a global `.npmrc` file, instead of configuring it in Renovate config.

This config option is disabled by default because it may prove surprising or undesirable for some users who don't expect Renovate to go into their home directory and import registry or credential information.

Currently this config option is supported for the `npm` manager only - specifically the `~/.npmrc` file.
If found, it will be imported into `config.npmrc` with `config.npmrcMerge` set to `true`.

## detectHostRulesFromEnv

The format of the environment variables must follow:

- Datasource name (e.g. `NPM`, `PYPI`)
- Underscore (`_`)
- `matchHost`
- Underscore (`_`)
- Field name (`TOKEN`, `USERNAME`, or `PASSWORD`)

Hyphens (`-`) in datasource or host name must be replaced with double underscores (`__`).
Periods (`.`) in host names must be replaced with a single underscore (`_`).

<!-- prettier-ignore -->
!!! note
    You can't use these prefixes with the `detectHostRulesFromEnv` config option: `npm_config_`, `npm_lifecycle_`, `npm_package_`.

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

For example, if you set `dockerChildPrefix=myprefix_` then the final container created from the `renovate/node` is:

- called `myprefix_node` instead of `renovate_node`
- labeled `myprefix_child` instead of `renovate_child`

<!-- prettier-ignore -->
!!! note
    Dangling containers are only removed when Renovate runs again with the same prefix.

## dockerImagePrefix

By default Renovate pulls the sidecar Docker containers from `docker.io/renovate`.
You can use the `dockerImagePrefix` option to override this default.

Say you want to pull your images from `ghcr.io/renovatebot`.
You would put this in your configuration file:

```json
{
  "dockerImagePrefix": "ghcr.io/renovatebot"
}
```

If you pulled a new `node` image, the final image would be `ghcr.io/renovatebot/node` instead of `docker.io/renovate/node`.

## dockerUser

Override default user and group used by Docker-based binaries.
The user-id (UID) and group-id (GID) must match the user that executes Renovate.

Read the [Docker run reference](https://docs.docker.com/engine/reference/run/#user) for more information on user and group syntax.
Set this to `1001:1002` to use UID 1001 and GID 1002.
For example:

```json
{
  "dockerUser": "1001:1002"
}
```

If you use `binarySource=docker|install` read the section below.

If you need to change the Docker user please make sure to use the root (`0`) group, otherwise you'll get in trouble with missing file and directory permissions.
Like this:

```
> export RENOVATE_DOCKER_USER="$(id -u):0" # 500:0 (username:root)
```

## dryRun

Use `dryRun` to preview the behavior of Renovate in logs, without making any changes to the repository files.

You can choose from the following behaviors for the `dryRun` config option:

- `null`: Default behavior - Performs a regular Renovate run including creating/updating/deleting branches and PRs
- `"extract"`: Performs a very quick package file scan to identify the extracted dependencies
- `"lookup"`: Performs a package file scan to identify the extracted dependencies and updates available
- `"full"`: Performs a dry run by logging messages instead of creating/updating/deleting branches and PRs

Information provided mainly in debug log level.

## endpoint

## executionTimeout

Default execution timeout in minutes for child processes Renovate creates.
If this option is not set, Renovate will fallback to 15 minutes.

## exposeAllEnv

To keep you safe, Renovate only passes a limited set of environment variables to package managers.
Confidential data can be leaked if a malicious script enumerates all environment variables.
Set `exposeAllEnv` to `true` only if you have reviewed, and trust, the repositories which Renovate bot runs against.

Setting this to `true` also allows for variable substitution in `.npmrc` files.

## force

This object is used as a "force override" when you need to make sure certain configuration overrides whatever is configured in the repository.
For example, forcing a null (no) schedule to make sure Renovate raises PRs on a run even if the repository itself or its preset defines a schedule that's currently inactive.

In practice, it is implemented by converting the `force` configuration into a `packageRule` that matches all packages.

## forceCli

This is set to `true` by default, meaning that any settings (such as `schedule`) take maximum priority even against custom settings existing inside individual repositories.
It will also override any settings in `packageRules`.

## forkMode

You probably have no need for this option - it is an experimental setting for the Renovate hosted GitHub App.
If this is set to `true` then Renovate will fork the repository into the personal space of the person owning the Personal Access Token.

## forkToken

You probably don't need this option - it is an experimental setting for the Renovate hosted GitHub App.
This should be set to a Personal Access Token (GitHub only) when `forkMode` is set to `true`.
Renovate will use this token to fork the repository into the personal space of the person owning the Personal Access Token.
Renovate will then create branches on the fork and opens Pull Requests on the parent repository.

## gitNoVerify

Controls when Renovate passes the `--no-verify` flag to `git`.
The flag can be passed to `git commit` and/or `git push`.
Read the documentation for [git commit --no-verify](https://git-scm.com/docs/git-commit#Documentation/git-commit.txt---no-verify) and [git push --no-verify](https://git-scm.com/docs/git-push#Documentation/git-push.txt---no-verify) to learn exactly what each flag does.
To learn more about Git hooks, read the [Pro Git 2 book, section on Git Hooks](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks).

## gitPrivateKey

This should be an armored private key, so the type you get from running `gpg --export-secret-keys --armor 92066A17F0D1707B4E96863955FEF5171C45FAE5 > private.key`.
Replace the newlines with `\n` before adding the resulting single-line value to your bot's config.

<!-- prettier-ignore -->
!!! note
    The private key can't be protected with a passphrase if running in a headless environment. Renovate will not be able to handle entering the passphrase.

It will be loaded _lazily_.
Before the first commit in a repository, Renovate will:

1. Run `gpg import` (if you haven't before)
1. Run `git config user.signingkey` and `git config commit.gpgsign true`

The `git` commands are run locally in the cloned repo instead of globally.
This reduces the chance of unintended consequences with global Git configs on shared systems.

## gitTimeout

To handle the case where the underlying Git processes appear to hang, configure the timeout with the number of milliseconds to wait after last received content on either `stdOut` or `stdErr` streams before sending a `SIGINT` kill message.

## gitUrl

Override the default resolution for Git remote, e.g. to switch GitLab from HTTPS to SSH-based.
Currently works for Bitbucket Server and GitLab only.

Possible values:

- `default`: use HTTPS URLs provided by the platform for Git
- `ssh`: use SSH URLs provided by the platform for Git
- `endpoint`: ignore URLs provided by the platform and use the configured endpoint directly

## githubTokenWarn

By default, Renovate logs and displays a warning when the `GITHUB_COM_TOKEN` is not set.
By setting `githubTokenWarn` to `false`, Renovate suppresses these warnings on Pull Requests, etc.
Disabling the warning is helpful for self-hosted environments that can't access the `github.com` domain, because the warning is useless in these environments.

## globalExtends

Unlike the `extends` field, which is passed through unresolved to be part of repository config, any presets in `globalExtends` are resolved immediately as part of global config.
Use the `globalExtends` field if your preset has any global-only configuration options, such as the list of repositories to run against.

Use the `extends` field instead of this if, for example, you need the ability for a repository config (e.g. `renovate.json`) to be able to use `ignorePresets` for any preset defined in global config.

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

<!-- prettier-ignore -->
!!! tip
    Combine `migratePresets` with `configMigration` if you'd like your config migrated by PR.

## onboarding

Only set this to `false` if all three statements are true:

- You've configured Renovate entirely on the bot side (e.g. empty `renovate.json` in repositories)
- You want to run Renovate on every repository the bot has access to
- You want to skip all onboarding PRs

## onboardingBranch

<!-- prettier-ignore -->
!!! note
    This setting is independent of `branchPrefix`.

For example, if you configure `branchPrefix` to be `renovate-` then you'd still have the onboarding PR created with branch `renovate/configure` until you configure `onboardingBranch=renovate-configure` or similar.
If you have an existing Renovate installation and you change `onboardingBranch` then it's possible that you'll get onboarding PRs for repositories that had previously closed the onboarding PR unmerged.

## onboardingCommitMessage

If `commitMessagePrefix` or `semanticCommits` values are set then they will be prepended to the commit message using the same logic that is used for adding them to non-onboarding commit messages.

## onboardingConfig

## onboardingConfigFileName

If set to one of the valid [config file names](https://docs.renovatebot.com/configuration-options/), the onboarding PR will create a configuration file with the provided name instead of `renovate.json`.
Falls back to `renovate.json` if the name provided is not valid.

## onboardingNoDeps

Set this to `true` if you want Renovate to create an onboarding PR even if no dependencies are found.
Otherwise, Renovate skips onboarding a repository if it finds no dependencies in it.

## onboardingPrTitle

Similarly to `onboardingBranch`, if you have an existing Renovate installation and you change `onboardingPrTitle` then it's possible that you'll get onboarding PRs for repositories that had previously closed the onboarding PR unmerged.

## optimizeForDisabled

## password

## persistRepoData

Set this to `true` if you want Renovate to persist repo data between runs.
The intention is that this allows Renovate to do a faster `git fetch` between runs rather than `git clone`.
It also may mean that ignored directories like `node_modules` can be preserved and save time on operations like `npm install`.

## platform

## prCommitsPerRunLimit

Parameter to reduce CI load.
CI jobs are usually triggered by these events: pull-request creation, pull-request update, automerge events.
Set as an integer.
Default is no limit.

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

<!-- prettier-ignore -->
!!! note
    Simple public key encryption was previously used to encrypt secrets, but this approach has been deprecated and is no longer documented.

## privateKeyOld

Use this field if you need to perform a "key rotation" and support more than one keypair at a time.
Decryption with this key will be tried after `privateKey`.

If you are migrating from the legacy public key encryption approach to use GPG, then move your legacy private key from `privateKey` to `privateKeyOld` and then put your new GPG private key in `privateKey`.
Doing so will mean that Renovate will first try to decrypt using the GPG key but fall back to the legacy key and try that next.

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

Elements in the `repositories` array can be an object if you wish to define additional settings:

```js
{
  repositories: [{ repository: 'g/r1', bumpVersion: true }, 'g/r2'];
}
```

## repositoryCache

Set this to `"enabled"` to have Renovate maintain a JSON file cache per-repository to speed up extractions.
Set to `"reset"` if you ever need to bypass the cache and have it overwritten.
JSON files will be stored inside the `cacheDir` beside the existing file-based package cache.

## repositoryCacheType

Set this to an S3 URI to enable S3 backed repository cache.

```ts
{
  repositoryCacheType: 's3://bucket-name';
}
```

<!-- prettier-ignore -->
!!! note
    [IAM is supported](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/loading-node-credentials-iam.html) when running renovate within an EC2 instance in an ECS cluster. In this case, no additional environment variables are required.
    Otherwise, the following environment variables should be set for the S3 client to work.

```
    AWS_ACCESS_KEY_ID
    AWS_SECRET_ACCESS_KEY
    AWS_SESSION_TOKEN
    AWS_REGION
```

## requireConfig

By default, Renovate needs a Renovate config file in each repository where it runs before it will propose any dependency updates.

You can choose any of these settings:

- `"required"` (default): a repository config file must be present
- `"optional"`: if a config file exists, Renovate will use it when it runs
- `"ignored"`: config files in the repo will be ignored, and have no effect

This feature is closely related to the `onboarding` config option.
The combinations of `requireConfig` and `onboarding` are:

|                          | `onboarding=true`                                                                                                                                       | `onboarding=false`                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `requireConfig=required` | An onboarding PR will be created if no config file exists. If the onboarding PR is closed and there's no config file, then the repository is skipped.   | Repository is skipped unless a config file is added manually. |
| `requireConfig=optional` | An onboarding PR will be created if no config file exists. If the onboarding PR is closed and there's no config file, the repository will be processed. | Repository is processed regardless of config file presence.   |
| `requireConfig=ignored`  | No onboarding PR will be created and repo will be processed while ignoring any config file present.                                                     | Repository is processed, any config file is ignored.          |

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

Secret names must start with an upper or lower case character and can have only characters, digits, or underscores.

## skipInstalls

By default, Renovate will use the most efficient approach to updating package files and lock files, which in most cases skips the need to perform a full module install by the bot.
If this is set to false, then a full install of modules will be done.
This is currently applicable to `npm` and `lerna`/`npm` only, and only used in cases where bugs in `npm` result in incorrect lock files being updated.

## token

## unicodeEmoji

If enabled emoji shortcodes are replaced with their Unicode equivalents.
For example: `:warning:` will be replaced with `⚠️`.

## username

You may need to set a `username` if you:

- use the Bitbucket platform, or
- use the GitHub App with CLI (required)

If you're using a Personal Access Token (PAT) to authenticate then you should not set a `username`.

## writeDiscoveredRepos

Optional parameter which allows to write the discovered repositories into a JSON file instead of renovating them.

Usage: `renovate --write-discovered-repos=/tmp/renovate-repos.json`

```json
["myOrg/myRepo", "myOrg/anotherRepo"]
```
