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

Let's look at an example of configuring packages with existing Angular migrations.

```javascript
module.exports = {
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
        ]
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

If you wish to disable templating because of any security or performance concern, you may set `allowPostUpgradeCommandTemplating` to `false`.
But before you disable templating completely, try the `allowedPostUpgradeCommands` config option to limit what commands are allowed to run.

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

If you set multiple filters, then the matches of each filter are added to the overall result.

If you use an environment variable or the CLI to set the value for `autodiscoverFilter`, then commas `,` within filters are not supported.
Commas will be used as delimiter for a new filter.

```
# DO NOT use commas inside the filter if your are using env or CLI variables to configure it.
RENOVATE_AUTODISCOVER_FILTER="/myapp/{readme.md,src/**}"

# in this example you can use regex instead
RENOVATE_AUTODISCOVER_FILTER="/myapp/(readme\.md|src/.*)/"
```

**Minimatch**:

```json
{
  "autodiscoverFilter": ["project/*"]
}
```

The search for repositories is case-insensitive.

**Regex**:

All text inside the start and end `/` will be treated as a regular expression.

```json
{
  "autodiscoverFilter": ["/project/.*/"]
}
```

You can negate the regex by putting an `!` in front.
Only use a single negation and don't mix with other filters because all filters are combined with `or`.
If using negations, all repositories except those who match the regex are added to the result:

```json
{
  "autodiscoverFilter": ["!/project/.*/"]
}
```

## autodiscoverNamespaces

You can use this option to autodiscover projects in specific namespaces (a.k.a. groups/organizations/workspaces).
In contrast to `autodiscoverFilter` the filtering is done by the platform and therefore more efficient.

For example:

```json
{
  "platform": "gitlab",
  "autodiscoverNamespaces": ["a-group", "another-group/some-subgroup"]
}
```

## autodiscoverTopics

Some platforms allow you to add tags, or topics, to repositories and retrieve repository lists by specifying those
topics. Set this variable to a list of strings, all of which will be topics for the autodiscovered repositories.

For example:

```json
{
  "autodiscoverTopics": ["managed-by-renovate"]
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

## bbUseDevelopmentBranch

By default, Renovate will use a repository's "main branch" (typically called `main` or `master`) as the "default branch".

Configuring this to `true` means that Renovate will detect and use the Bitbucket [development branch](https://support.atlassian.com/bitbucket-cloud/docs/branch-a-repository/#The-branching-model) as defined by the repository's branching model.

If the "development branch" is configured but the branch itself does not exist (e.g. it was deleted), Renovate will fall back to using the repository's "main branch". This fall back behavior matches that of the Bitbucket Cloud web interface.

## binarySource

Renovate often needs to use third-party tools in its PRs, like `npm` to update `package-lock.json` or `go` to update `go.sum`.

Renovate supports four possible ways to access those tools:

- `global`: Uses pre-installed tools, e.g. `npm` installed via `npm install -g npm`.
- `install` (default): Downloads and installs tools at runtime if running in a [Containerbase](https://github.com/containerbase/base) environment, otherwise falls back to `global`
- `docker`: Runs tools inside Docker "sidecar" containers using `docker run`.
- `hermit`: Uses the [Hermit](https://github.com/cashapp/hermit) tool installation approach.

Starting in v36, Renovate's default Docker image (previously referred to as the "slim" image) uses `binarySource=install` while the "full" Docker image uses `binarySource=global`.
If you are running Renovate in an environment where runtime download and install of tools is not possible then you should use the "full" image.

If you are building your own Renovate image, e.g. by installing Renovate using `npm`, then you will need to ensure that all necessary tools are installed globally before running Renovate so that `binarySource=global` will work.

The `binarySource=docker` approach should not be necessary in most cases now and `binarySource=install` is recommended instead.
If you have a use case where you cannot use `binarySource=install` but can use `binarySource=docker` then please share it in a GitHub Discussion so that the maintainers can understand it.
For this to work, `docker` needs to be installed and the Docker socket available to Renovate.

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

## cacheHardTtlMinutes

This experimental feature is used to implement the concept of a "soft" cache expiry for datasources, starting with `npm`.
It should be set to a non-zero value, recommended to be at least 60 (i.e. one hour).

When this value is set, the `npm` datasource will use the `cacheHardTtlMinutes` value for cache expiry, instead of its default expiry of 15 minutes, which becomes the "soft" expiry value.
Results which are soft expired are reused in the following manner:

- The `etag` from the cached results will be reused, and may result in a 304 response, meaning cached results are revalidated
- If an error occurs when querying the `npmjs` registry, then soft expired results will be reused if they are present

## cacheTtlOverride

Utilize this key-value map to override the default package cache TTL values for a specific namespace. This object contains pairs of namespaces and their corresponding TTL values in minutes.
For example, to override the default TTL of 60 minutes for the `docker` datasource "tags" namespace: `datasource-docker-tags` use the following:

```json
{
  "cacheTtlOverride": {
    "datasource-docker-tags": 120
  }
}
```

## checkedBranches

This array will allow you to set the names of the branches you want to rebase/create, as if you selected their checkboxes in the Dependency Dashboard issue.

It has been designed with the intention of being run on one repository, in a one-off manner, e.g. to "force" the rebase of a known existing branch.
It is highly unlikely that you should ever need to add this to your permanent global config.

Example: `renovate --checked-branches=renovate/chalk-4.x renovate-reproductions/checked` will rebase the `renovate/chalk-4.x` branch in the `renovate-reproductions/checked` repository.`

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

- Datasource name (e.g. `NPM`, `PYPI`) or Platform name (only `GITHUB`)
- Underscore (`_`)
- `matchHost`
- Underscore (`_`)
- Field name (`TOKEN`, `USERNAME`, `PASSWORD`, `HTTPSPRIVATEKEY`, `HTTPSCERTIFICATE`, `HTTPSCERTIFICATEAUTHORITY`)

Hyphens (`-`) in datasource or host name must be replaced with double underscores (`__`).
Periods (`.`) in host names must be replaced with a single underscore (`_`).

<!-- prettier-ignore -->
!!! note
    You can't use these prefixes with the `detectHostRulesFromEnv` config option: `npm_config_`, `npm_lifecycle_`, `npm_package_`.
    In addition, platform host rules will only be picked up when `matchHost` is supplied.

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

You can skip the host part, and use only the datasource and credentials.

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

### Platform with https authentication options

`GITHUB_SOME_GITHUB__ENTERPRISE_HOST_HTTPSCERTIFICATE=certificate GITHUB_SOME_GITHUB__ENTERPRISE_HOST_HTTPSPRIVATEKEY=private-key GITHUB_SOME_GITHUB__ENTERPRISE_HOST_HTTPSCERTIFICATEAUTHORITY=certificate-authority`:

```json
{
  "hostRules": [
    {
      "hostType": "github",
      "matchHost": "some.github-enterprise.host",
      "httpsPrivateKey": "private-key",
      "httpsCertificate": "certificate",
      "httpsCertificateAuthority": "certificate-authority"
    }
  ]
}
```

## dockerChildPrefix

Adds a custom prefix to the default Renovate sidecar Docker containers name and label.

For example, if you set `dockerChildPrefix=myprefix_` then the final container created from the `containerbase/sidecar` is:

- called `myprefix_sidecar` instead of `renovate_sidecar`
- labeled `myprefix_child` instead of `renovate_child`

<!-- prettier-ignore -->
!!! note
    Dangling containers are only removed when Renovate runs again with the same prefix.

## dockerCliOptions

You can use `dockerCliOptions` to pass Docker CLI options to Renovate's sidecar Docker containers.

For example, `{"dockerCliOptions": "--memory=4g"}` will add a CLI flag to the `docker run` command that limits the amount of memory Renovate's sidecar Docker container can use to 4 gigabytes.

Read the [Docker Docs, configure runtime resource contraints](https://docs.docker.com/config/containers/resource_constraints/) to learn more.

## dockerSidecarImage

By default Renovate pulls the sidecar Docker containers from `ghcr.io/containerbase/sidecar`.
You can use the `dockerSidecarImage` option to override this default.

Say you want to pull a custom image from `ghcr.io/your_company/sidecar`.
You would put this in your configuration file:

```json
{
  "dockerSidecarImage": "ghcr.io/your_company/sidecar"
}
```

Now when Renovate pulls a new `sidecar` image, the final image is `ghcr.io/containerbase/sidecar` instead of `docker.io/containerbase/sidecar`.

## dockerUser

Override default user and group used by Docker-based tools.
The user-id (UID) and group-id (GID) must match the user that executes Renovate.

Read the [Docker run reference](https://docs.docker.com/engine/reference/run/#user) for more information on user and group syntax.
Set this to `1001:1002` to use UID 1001 and GID 1002.

```json title="Setting UID to 1001 and GID to 1002"
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
If you must expose all environment variables to package managers, you can set this option to `true`.

<!-- prettier-ignore -->
!!! warning
    Always consider the security implications of using `exposeAllEnv`!
    Secrets and other confidential information stored in environment variables could be leaked by a malicious script, that enumerates all environment variables.

Set `exposeAllEnv` to `true` only if you have reviewed, and trust, the repositories which Renovate bot runs against.
Alternatively, you can use the [`customEnvVariables`](./self-hosted-configuration.md#customenvvariables) config option to handpick a set of variables you need to expose.

Setting this to `true` also allows for variable substitution in `.npmrc` files.

## force

This object is used as a "force override" when you need to make sure certain configuration overrides whatever is configured in the repository.
For example, forcing a null (no) schedule to make sure Renovate raises PRs on a run even if the repository itself or its preset defines a schedule that's currently inactive.

In practice, it is implemented by converting the `force` configuration into a `packageRule` that matches all packages.

## forceCli

This is set to `true` by default, meaning that any settings (such as `schedule`) take maximum priority even against custom settings existing inside individual repositories.
It will also override any settings in `packageRules`.

## forkOrg

This configuration option lets you choose an organization you want repositories forked into when "fork mode" is enabled.
It must be set to a GitHub Organization name and not a GitHub user account.
When set, "allow edits by maintainers" will be false for PRs because GitHub does not allow this setting for organizations.

This can be used if you're migrating from user-based forks to organization-based forks.

If you've set a `forkOrg` then Renovate will:

1. Check if a fork exists in the preferred organization before checking it exists in the fork user's account
1. If no fork exists: it will be created in the `forkOrg`, not the user account

## forkToken

If this value is configured then Renovate:

- forks the target repository into the account that owns the PAT
- keep this fork's default branch up-to-date with the target

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

<!-- prettier-ignore -->
!!! warning
    `globalExtends` presets can't be private.
    When Renovate resolves `globalExtends` it does not fully process the configuration.
    This means that Renovate does not have the authentication it needs to fetch private things.

## includeMirrors

By default, Renovate does not autodiscover repositories that are mirrors.

Change this setting to `true` to include repositories that are mirrors as Renovate targets.

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

If set to one of the valid [config file names](./configuration-options.md), the onboarding PR will create a configuration file with the provided name instead of `renovate.json`.
Falls back to `renovate.json` if the name provided is not valid.

## onboardingNoDeps

Set this to `true` if you want Renovate to create an onboarding PR even if no dependencies are found.
Otherwise, Renovate skips onboarding a repository if it finds no dependencies in it.

## onboardingPrTitle

If you have an existing Renovate installation and you change the `onboardingPrTitle`: then you may get onboarding PRs _again_ for repositories with closed non-merged onboarding PRs.
This is similar to what happens when you change the `onboardingBranch` config option.

## onboardingRebaseCheckbox

## optimizeForDisabled

When this option is `true`, Renovate will do the following during repository initialization:

1. Try to fetch the default config file (e.g. `renovate.json`)
1. Check if the file contains `"enabled": false`
1. If so, skip cloning and skip the repository immediately

If `onboardingConfigFileName` is set, that file name will be used instead of the default.

If the file exists and the config is disabled, Renovate will skip the repo without cloning it.
Otherwise, it will continue as normal.

`optimizeForDisabled` can make initialization quicker in cases where most repositories are disabled, but it uses an extra API call for enabled repositories.

A second, advanced, use also exists when the bot global config has `extends: [":disableRenovate"]`.
In that case, Renovate searches the repository config file for any of these configurations:

- `extends: [":enableRenovate"]`
- `ignorePresets: [":disableRenovate"]`
- `enabled: true`

If Renovate finds any of the above configurations, it continues initializing the repository.
If not, then Renovate skips the repository without cloning it.

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
If you want a UI to encrypt values you can put the public key in a HTML page similar to <https://app.renovatebot.com/encrypt>.

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
    You could use public key encryption with earlier versions of Renovate.
    We deprecated this approach and removed the documentation for it.
    If you're _still_ using public key encryption then we recommend that you use private keys instead.

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
The global cache is used to store lookup results (e.g. dependency versions and changelogs) between repositories and runs.

For non encrypted connections,

Example URL structure: `redis://[[username]:[password]]@localhost:6379/0`.

For TLS/SSL-enabled connections, use rediss prefix

Example URL structure: `rediss://[[username]:[password]]@localhost:6379/0`.

## repositories

Elements in the `repositories` array can be an object if you wish to define more settings:

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

```ts title="Set repositoryCacheType to an S3 URI to enable S3 backed repository cache"
{
  repositoryCacheType: 's3://bucket-name';
}
```

<!-- prettier-ignore -->
!!! note
    [IAM is supported](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/loading-node-credentials-iam.html) when running Renovate within an EC2 instance in an ECS cluster. In this case, no extra environment variables are required.
    Otherwise, the following environment variables should be set for the S3 client to work.

```
    AWS_ACCESS_KEY_ID
    AWS_SECRET_ACCESS_KEY
    AWS_SESSION_TOKEN
    AWS_REGION
```

<!-- prettier-ignore -->
!!! tip
    If you're storing the repository cache on Amazon S3 then you may set a folder hierarchy as part of `repositoryCacheType`.
    For example, `repositoryCacheType: 's3://bucket-name/dir1/.../dirN/'`.

<!-- prettier-ignore -->
!!! note
    S3 repository is used as a repository cache (e.g. extracted dependencies) and not a lookup cache (e.g. available versions of dependencies). To keep the later remotely, define [Redis URL](#redisurl).

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
This is currently applicable to `npm` only, and only used in cases where bugs in `npm` result in incorrect lock files being updated.

## token

## unicodeEmoji

If enabled emoji shortcodes are replaced with their Unicode equivalents.
For example: `:warning:` will be replaced with `⚠️`.

## username

You may need to set a `username` if you:

- use the Bitbucket platform, or
- use a self-hosted GitHub App with CLI (required)

If you're using a Personal Access Token (PAT) to authenticate then you should not set a `username`.

## writeDiscoveredRepos

By default, Renovate processes each repository that it finds.
You can use this optional parameter so Renovate writes the discovered repositories to a JSON file and exits.

Known use cases consist, among other things, of horizontal scaling setups.
See [Scaling Renovate Bot on self-hosted GitLab](https://github.com/renovatebot/renovate/discussions/13172).

Usage: `renovate --write-discovered-repos=/tmp/renovate-repos.json`

```json
["myOrg/myRepo", "myOrg/anotherRepo"]
```
