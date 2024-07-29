# Release notes for major versions of Renovate

It can be hard to keep track of the changes between major versions of Renovate.
To help you, we've listed the breaking changes, plus the developer commentary for the latest major releases.

The most recent versions are always at the top of the page.
This is because recent versions may revert changes made in an older version.
You also don't have to scroll to the bottom of the page to find the latest release notes.

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
- The "full" image is now available via the tag `full`, e.g. `renovate/renovate:38-full`, and defaults to `binarySource=global` (no dynamic installs)
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
