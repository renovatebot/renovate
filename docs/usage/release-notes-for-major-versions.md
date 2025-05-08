# Release notes for major versions of Renovate

It can be hard to keep track of the changes between major versions of Renovate.
To help you, we've listed the breaking changes, plus the developer commentary for the latest major releases.

The most recent versions are always at the top of the page.
This is because recent versions may revert changes made in an older version.
You also don't have to scroll to the bottom of the page to find the latest release notes.

## Version 39

### Breaking changes for 39

#### New tools for all Docker images

All our Docker images now use:

- Node.js v22 as base, was Node.js v20
- Ubuntu 24.04 as base, was 20.04

#### New Docker user ID for all Docker images

All our Docker images now set the Docker user ID to `12021`, the old ID was `1001`.

After updating your Renovate Docker image to the new v39 release, you must:

- Delete your old Docker cache, _or_
- Ensure the new user ID has write permissions to any existing cache

#### Updated version of Python, and new default behavior for the `-full` Docker image

On top of the changes listed above, the `-full` image now:

- Uses Python 3.13
- Defaults to [`binarySource=global`](self-hosted-configuration.md#binarysource) (note: this was previously the case in v36 onwards but regressed sometime in v38)

If you want to keep the old behavior, where Renovate dynamically installs the needed tools: set the environment variable `RENOVATE_BINARY_SOURCE` to `"install"`.

#### Renovate tries squash merges first when automerging on GitHub

Due to technical reasons, GitHub will only sign commits coming from a squash merge.
To help those who want Renovate to sign its commits, Renovate now tries the squash merge first.

Of course, Renovate only uses the merge method(s) that you allow in your GitHub repository config.

##### How you can allow squash merges on your GitHub repository

If you want to allow squash merges on your GitHub repository, follow the steps in the [GitHub Docs, configuring commit squashing for pull requests](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/configuring-commit-squashing-for-pull-requests).

#### Branch names with multiple slashes

If you set `branchNameStrict=true`, then branch names with multiple forward slashes (`/`) will change.

The problem was that even if you set `branchNameStrict=true`, in some cases special characters could still end up in Renovate's branch names.
We fixed this problem, by letting Renovate convert multiple forward slashes (`/`) to hyphens (`-`) in its branch names, if `branchNameStrict=true`.

### Commentary for 39

#### Technical reasons for trying the squash merge first on GitHub

Renovate has changed its GitHub merge preference to "squash" because this way results in signed commits, while "rebase" merges do not.

Read the [GitHub Docs, Signature verification for rebase and merge](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification#signature-verification-for-rebase-and-merge) to learn more about commit signing.

#### Why we change branch names with multiple slashes

Branches with multiple slashes (`/`) are not wanted, this was a bug.
We are changing it in a major release out of politeness to all our users.
If you enabled `branchNameStrict`, you can expect some branch names to change.

### Link to release notes for 39

[Release notes for `v39` on GitHub](https://github.com/renovatebot/renovate/releases/tag/39.0.0).

## Version 38

### Breaking changes for 38

General:

- Require Node.js 20 ([#30291](https://github.com/renovatebot/renovate/pull/30291))
- The Renovate Docker images no longer have `-slim` tags. You must stop using the `-slim` prefix. Renovate now defaults to the `-slim` tag type behavior.

Specific:

- **bitbucket-server:** autodetect `gitAuthor`, if possible ([#29525](https://github.com/renovatebot/renovate/pull/29525))
- **config:** change from `boolean` to `enum` for `onboardingNoDeps`. Renovate now onboards repositories with no dependencies, with one exception: if you run Renovate in `autodiscover` mode then you must manually onboard Renovate for repos with no dependencies
- **config:** sanitize special characters from branch names for vulnerability type PRs. This may cause Renovate to autoclose/replace existing PRs
- **config:** change the order of `globalExtends` resolution, it is applied _first_ and remaining global config takes precedence
- **datasource/docker:** Docker Hub lookups prefers `hub.docker.com` over `index.docker.io`. To revert to the old behavior: set `RENOVATE_X_DOCKER_HUB_TAGS_DISABLE=true` in your env
- **git:** check _all_ commits on the branch to decide if the branch was modified ([#28225](https://github.com/renovatebot/renovate/pull/28225))
- **gitea:** use "bearer auth" instead of "token auth" to authenticate to the Gitea platform
- **github:** if you run Renovate as a GitHub app then `platformCommit` is automatically enabled
- **gomod:** the value of `GOSUMDB` was previously set to `off`, meaning the Go toolchain would not validate signatures for modules. This has now been corrected, which may result in errors updating Go modules. In particular, if you are using Renovate with private Go modules, you will need to set `GOPRIVATE`. For more details, see [Go's official documentation for working with private Go modules](https://golang.org/ref/mod#private-modules).
- **http:** remove `dnsCache`
- **logging:** you must set file logging via env, not in `config.js`
- **manager/pep621:** change `depName` for `pep621` dependencies. This causes the branch name for `pep621` updates to change, which in turn means Renovate may autoclose and re-open some `pep621` PRs. Also, Renovate may start grouping dependencies into a single PR.
- **npm:** for npm versions lower than 7, drop support for remediating vulnerabilities in _transitive_ dependencies
- **npm:** remove `RENOVATE_CACHE_NPM_MINUTES` ([#28715](https://github.com/renovatebot/renovate/pull/28715))
- **packageRules:** `matchPackageNames` (and related functions) no longer fall back to checking `depName`
- **packageRules:** `matchPackageNames` exact matches are now case-insensitive

### Commentary for 38

#### Our Docker images are slim by default

If you self-host using Renovate's Docker `-slim` images: drop the `-slim` suffix, and switch to the default tags.
Renovate's default tags like `38.0.0` are "slim" by default.
There's no change if you're using the `-full` images.

#### Renovate needs Node.js 20

Renovate now needs Node.js `^20.15.1` to run.
Our Docker images already use the correct version of Node.js.

But if you self-host _without_ using our Docker image, then you must update the version of Node.js.
You must update manually, if for example: you build your own image, or run the `renovate` npm package.

##### Why we picked Node 20

We dropped Node.js 18, and do not yet support Node.js 22 as it's non-LTS and not recommended for production.

##### Why we picked a non-vulnerable version of Node

We decided to require the current non-vulnerable version of Node.js (`20.15.1` or newer).
If we ever need to bump the minimum version of Node.js v20, we will release a new _major_ version of Renovate.

If you self-host: we recommend you always run a secure version of Node.js v20.
This is because security vulnerabilities in Node.js can affect Renovate too.

#### If you use Mend's Renovate GitHub app

We recommend that all users running Renovate as a GitHub App use `platformCommit`.
Renovate now defaults to `platformCommit` is enabled, when Renovate detects a GitHub App token.
For PATs, we still recommend regular commits.

#### Log file configuration requires env settings

File-based logging must be configured using environment variables (e.g. `LOG_FILE`).
Do _not_ set logging in files or CLI (such as `logFile`).

This ensures that logging begins right when Renovate starts a run.
It also means Renovates logs how it parses the config.

#### Changes to package matching

Finally, we merged the `matchPackage*` and `excludePackage*` options into `matchPackageNames`.
We also enabled patterns for the `matchPackageNames` config option.

This means you can now use regex or glob patterns:

- `"matchPackageNames": "/^com.renovatebot/"` (regex)
- `"matchPackageNames": "@renovate/*"` (glob)

And of course, you can still use exact name matching.

### Link to release notes for 38

[Release notes for `v38` on GitHub](https://github.com/renovatebot/renovate/releases/tag/38.0.0).

## Version 37

### Breaking changes for 37

- **npm:** drop explicit lerna support

### Commentary for 37

We switched from "merge" strategy to "hunt" strategy to match with how Maven works.

Lerna v7 does not need our explicit support anymore, so we dropped it.
If you're on a version of Lerna before v7, you should prioritize upgrading to v7.

### Link to release notes for 37

[Release notes for `v37` on GitHub](https://github.com/renovatebot/renovate/releases/tag/37.0.0).

## Version 36

### Breaking changes for 36

- postUpgradeTasks.fileFilters is now optional and defaults to all files
- `languages` are now called `categories` instead. Use `matchCategories` in `packageRules`
- Node v19 is no longer supported
- **datasource:** `semver-coerced` is now the default versioning
- **presets:** Preset `config:base` is now called `config:recommended` (will be migrated automatically)
- remove `BUILDPACK` env support
- **package-rules:** `matchPackageNames` now matches both `depName` (existing) and `packageName` (new) and warns if only `depName` matches
- **release-notes:** Release notes won't be fetched early for `commitBody` insertion unless explicitly configured with `fetchReleaseNotes=branch`
- `dockerImagePrefix` is now replaced by `dockerSidecarImage`
- `matchPaths` and `matchFiles` are now combined into `matchFileNames`, supporting exact match and glob-only. The "any string match" functionality of `matchPaths` is now removed
- **presets:** v25 compatibility for language-based branch prefixes is removed
- **npm:** Rollback PRs will no longer be enabled by default for npm (they are now disabled by default for all managers)
- **post-upgrade-tasks:** dot files will now be included by default for all minimatch results
- **platform/gitlab:** GitLab `gitAuthor` will change from the account's "email" to "commit_email" if they are different
- **automerge:** Platform automerge will now be chosen by default whenever automerge is enabled
- Post upgrade templating is now allowed by default, as long as the post upgrade task command is itself already allowed
- Official Renovate Docker images now use the "slim" approach with `binarySource=install` by default. e.g. `renovate/renovate:latest` is the slim image, not full
- The "full" image is now available via the tag `full`, e.g. `renovate/renovate:40-full`, and defaults to `binarySource=global` (no dynamic installs)
- Third party tools in the full image have been updated to latest/LTS major version

### Commentary for 36

If you're self-hosting Renovate, pay particular attention to:

- Do you want to run the full, or slim versions of the image? We have switched the defaults (latest is now slim, not full)
- Have you configured `dockerImagePrefix`? If so then you need to use `dockerSidecarImage` instead
- If you're using `config:base` in your `onboardingConfig` then switch to `config:recommended`
- `gitAuthor` may change if you're on GitLab and have a different commit email for your bot account. If so then configure `gitIgnoredAuthors` with the old email

### Link to release notes for 36

[Release notes for `v36` on GitHub](https://github.com/renovatebot/renovate/releases/tag/36.0.0).

## Version 35

### Breaking changes for 35

- require NodeJS v18.12+ ([#20838](https://github.com/renovatebot/renovate/pull/20838))
- **config:** Forked repos will now be processed automatically if `autodiscover=false`. `includeForks` is removed and replaced by new option `forkProcessing`
- Internal checks such as `renovate/stability-days` will no longer count as passing/green, meaning that actions such as `automerge` won't occur if the only checks are Renovate internal ones. Set `internalChecksAsSuccess=true` to restore existing behavior
- **versioning:** default versioning is now `semver-coerced`, instead of `semver`
- **datasource/github-releases:** Regex Manager configurations relying on the github-release data-source with digests will have different digest semantics. The digest will now always correspond to the underlying Git SHA of the release/version. The old behavior can be preserved by switching to the github-release-attachments datasource
- **versioning:** bump short ranges to version ([#20494](https://github.com/renovatebot/renovate/pull/20494))
- **config:** `containerbase/` account used for sidecar containers instead of `renovate/`
- **go:** Renovate will now use go's default `GOPROXY` settings. To avoid using the public proxy, configure `GOPROXY=direct`
- **datasource/npm:** Package cache will include entries for up to 24 hours after the last lookup. Set `cacheHardTtlMinutes=0` to revert to existing behavior
- **config:** Renovate now defaults to applying hourly and concurrent PR limits. To revert to unlimited, configure them back to `0`
- **config:** Renovate will now default to updating locked dependency versions. To revert to previous behavior, configure `rangeStrategy=replace`
- **config:** PyPI releases will no longer be filtered by default based on `constraints.python` compatibility. To retain existing functionality, set `constraintsFiltering=strict`

### Commentary for 35

Most of these changes will be invisible to the majority of users.
They may be "breaking" (change of behavior) but good changes of defaults to make.

The biggest change is defaulting `rangeStrategy=auto` to use `update-lockfile` instead of `replace`, which impacts anyone using the recommended `config:base`.
This will mean that you start seeing some "lockfile-only" PRs for in-range updates, such as updating `package-lock.json` when a range exists in `package.json`.

### Link to release notes for 35

[Release notes for `v35` on GitHub](https://github.com/renovatebot/renovate/releases/tag/35.0.0).

## Version 34

### Breaking changes for 34

- Revert `branchNameStrict` to `false`

### Commentary for 34

Here comes v34 hot on the heels of v33.
We decided to issue another breaking change to revert one of the breaking changes in v33.

If you are upgrading from v32 to v34 then it means that the setting for `branchNameStrict` remains as `false` and you don't need to worry about that.

If you already upgraded from v32 to v33 then you have a decision to make first:

- set `branchNameStrict` to `true` (like in v33),
- or let it set back to `false` (like in v32).

Strict branch naming meant that all special characters other than letters, numbers and hyphens were converted to hyphens and then deduplicated, e.g. a branch which in v32 was like `renovate/abc.def-2.x` would become `renovate/abc-def-2-x` in v33.
If you prefer to revert back to the old way then that will happen automatically in v34.
If you prefer to keep the way in v33 because you already had a bunch of PRs closed and reopened due to branch names, and don't want to do that again, then add `branchNameStrict: false` to your bot config or your shared config before updating to v34.

Apologies to anyone negatively affected by this v33 change.

### Link to release notes for 34

[Release notes for `v34` on GitHub](https://github.com/renovatebot/renovate/releases/tag/34.0.0).

## Version 33

### Breaking changes for 33

- Node 16 is the required runtime for Renovate
- [NOTE: This was reverted in `v34`] **config:** `branchNameStrict` default value is now `true`
- **config:** `internalChecksFilter` default value is now `"strict"`
- **config:** `ignoreScripts` default value is now `true`. If `allowScripts=true` in global config, `ignoreScripts` must be set to `false` in repo config if you want all repos to run scripts
- **config:** `autodiscover` filters can no longer include commas
- **config:** boolean variables must be `true` or `false` when configured in environment variables, and errors will be thrown for invalid values. Previously invalided values were ignored and treated as `false`
- **datasource/go:** `git-tags` datasource will be used as the fallback instead of `github-tags` if a go package's host type is unknown
- **jsonnet-bundler:** `depName` now uses the "absolute import" format (e.g. `bar`-> `github.com/foo/bar/baz-wow`)
- **azure-pipelines:** azure-pipelines manager is now disabled by default
- **github:** No longer necessary to configure forkMode. Forking mode is now experimental
- Users of `containerbase` images (such as official Renovate images) will now have dynamic package manager installs enabled by default
- Dependencies are no longer automatically pinned if `rangeStrategy=auto`, pinning must be opted into using `rangeStrategy=pin`

### Commentary for 33

This release contains some changes of default values/behavior:

- `internalChecksFilter` will now default to `strict`, meaning that updates will be withheld by default when internal status checks are pending. This should reduce the number of "non-actionable" Pull Requests you get
- `azure-pipelines` manager is disabled by default, because its primary datasource can unfortunately suggest updates which aren't yet installable. Users should opt into this manager once they know the risks
- `binarySource=install` will now be used instead of `global` whenever Renovate is run within a "containerbase" image. This means dynamic installation of most package managers and languages
- Dependencies will no longer be pinned by default if `rangeStrategy=auto`. While we recommend pinning dependencies, we decided users should opt into this more explicitly

And two major features!

- AWS CodeCommit platform support
- OpenTelemetry support

Both the above are considered "experimental".
Please test them out and let us know your feedback - both positive or negative - so that we can progress them to fully available.

### Link to release notes for 33

[Release notes for `v33` on GitHub](https://github.com/renovatebot/renovate/releases/tag/33.0.0).
