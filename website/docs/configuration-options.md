---
title: Configuration Options
description: Configuration Options usable in renovate.json or package.json
---

# Configuration Options

This document describes all the configuration options you may configure in a `renovate.json` file or within a `"renovate"` section of your `package.json`. Any config you define applies to the whole repository (e.g. if you have a monorepo).

Also, be sure to check out Renovate's [shareable config presets](./config-presets/) to save yourself from reinventing any wheels.

If you have any questions about the below config options, or would like to get help/feedback about a config, please post it as an issue in [renovatebot/config-help](https://github.com/renovatebot/config-help) where it will be promptly answered.

## ansible

Add configuration here if you want to enable or disable something in particular for Ansible files and override the default Docker settings.

## assignees

Must be valid usernames.

## automerge

By default, Renovate raises PRs but leaves them to someone/something else to merge them. By configuring this setting, you can enable Renovate to automerge branches or PRs itself, therefore reducing the amount of human intervention required.

Usually you won't want to automerge _all_ PRs, for example most people would want to leave major dependency updates to a human to review first. In that case you will want to embed this setting inside `major`, `minor`, or `patch` configuration options. For example, you could add this to your `renovate.json` to automerge only non-major updates:

```json
  "automerge": true,
  "major": {
    "automerge": false
  }
```

Also note that this option can be combined with other nested settings, such as dependency type. So for example you could elect to automerge all `devDependencies` only this way:

```json
  "devDependencies": {
    "automerge": true
  }
```

Warning: GitHub currently has a bug where automerge won't work if a GitHub Organization has protected their master branch, and there is no way to configure around this. Hence, automerging will try and fail in such situations. This doc will be updated once that bug/limitation is fixed by GitHub.

Warning: GitHub won't do automerge if the PR has a negative feedback.

## automergeComment

Example use:

```json
{
  "automerge": true,
  "automergeType": "pr-comment",
  "automergeComment": "@bors: r+"
}
```

## automergeType

Renovate will default to automerging after creating PRs, but you can override that to automerge _without_ PRs. There are two ways to merge branch upgrades: merge commits, and branch push.

Merge commits will employ the standard GitHub "merge commit" API, just like when you merge a PR with merge commit setting. The downside of this approach is that you will end up with merge commits and not a nice clean default branch!

Branch push employs GitHub's low-level `git` API to push the Renovate upgrade directly to the head of the base branch (e.g. `master`) to maintain a "clean" history. The downside of this approach is that it implicitly enables the `rebaseStalePrs` setting because otherwise we would risk pushing a bad commit to master. i.e. Renovate won't push the commit to base branch unless the branch is completely up-to-date with `master` and has passed tests, which means that if the default branch is getting updated regularly then it might take several rebases from Renovate until it has a branch commit that is safe to push to `master`.

## baseBranches

If left default (empty) then the default branch of the repository is used.

For most projects, this should be left as default. An example use case for using this setting is a project who uses the default `master` branch for releases and a separate branch `next` for preparing for the next release. In that case, the project may prefer for Pull Requests from Renovate to be opened against the `next` branch instead of `master`.

If instead the project needs _both_ `master` and `next` to be renovated, then both should be put into the `baseBranches` array.

It's possible to add this setting into the `renovate.json` file as part of the "Configure Renovate" onboarding PR. If so then Renovate will reflect this setting in its description and use package file contents from the custom base branch instead of default.

## bazel

## branchName

It's recommended to use our default templates, but you may override branch name if you really wish. It's recommended to still keep `depName` and `newMajor` in the branch name to make sure all other Renovate features can still work.

Example branch name: `renovate/eslint-4.x`.

## branchPrefix

You can modify this field if you want to change the prefix used. For example if you want branches to be like `deps/eslint-4.x` instead of `renovate/eslint-4.x` then you set `branchPrefix` = `deps/`. Or if you wish to avoid forward slashes in branch names then you could use `renovate_` instead, for example.

## branchTopic

This field is combined with `branchPrefix` and `managerBranchPrefix` to form the full `branchName`. `branchName` uniqueness is important for dependency update grouping or non-grouping so be cautious about ever editing this field manually.

## buildkite

## bumpVersion

Set this value to 'patch', 'minor' or 'major' to have Renovate update the version in your edited `package.json`. e.g. if you wish Renovate to always increase the target `package.json` version with a patch update, set this to `patch`.

You can also set this field to `"mirror:x"` where `x` is the name of a package in the `package.json`. Doing so means that the `package.json` `version` field will mirror whatever the version is that `x` depended on. Make sure that version is a pinned version of course, as otherwise it won't be valid.

## bundler

Bundler is now in alpha stage and ready for testing! [Details](https://renovatebot.com/blog/ruby-bundler-support)

## circleci

## commitBody

This is used whenever a commit "body" is needed, e.g. for adding [skip ci] or DCO signoff.

For example, To add `[skip ci]` to every commit you could configure:

```
  "commitBody": "[skip ci]"
```

## commitMessage

The commit message is less important than branchName so you may override it if you wish.

Example commit message: "chore(deps): Update dependency eslint to version 4.0.1"

## commitMessageAction

This is used to alter `commitMessage` and `prTitle` without needing to copy/paste the whole string. Actions may be like 'Update', 'Pin', 'Roll back', 'Refresh', etc.

## commitMessageExtra

This is used to alter `commitMessage` and `prTitle` without needing to copy/paste the whole string. The "extra" is usually an identifier of the new version, e.g. "to v1.3.2" or "to tag 9.2".

## commitMessagePrefix

This is used to alter `commitMessage` and `prTitle` without needing to copy/paste the whole string. The "prefix" is usually an automatically applied semantic commit prefix, however it can also be statically configured.

## commitMessageSuffix

This is used to add a suffix to commit messages. Usually left empty except for internal use (multiple base branches, and vulnerability alerts).

## commitMessageTopic

This is used to alter `commitMessage` and `prTitle` without needing to copy/paste the whole string. The "topic" is usually refers to the dependency being updated, e.g. "dependency react".

## compatibility

This is used to manually restrict which versions are possible to upgrade to based on their language support. For now this only supports `python`, other compatibility restrictions will be added in the future.

```json
"compatibility": {
  "python": "2.7"
}
```

## composer

Warning: composer support is in alpha stage so you probably only want to run this if you are helping get it feature-ready.

## description

The description field is used by config presets to describe what they do. They are then collated as part of the onboarding description.

## digest

Add to this object if you wish to define rules that apply only to PRs that update Docker digests.

## docker

Add config here if you wish it to apply to all Docker package managers (Dockerfile, Docker Compose, CircleCI, etc).

## docker-compose

Add configuration here if you want to enable or disable something in particular for Docker Compose files and override the default Docker settings.

## dockerfile

Add configuration here if you want to enable or disable something in particular for `Dockerfile` files and override the default Docker settings.

## enabled

Renovate is enabled for all packages by default, but this setting allows you to disable Renovate for specific packages, dependency types, package files, or even for the whole repository.

To disable Renovate for all `eslint` packages, you can configure a package rule like:

```json
"packageRules": [
  {
    "packagePatterns": ["^eslint"],
    "enabled": false
  }
]
```

To disable Renovate for `dependencies` but keep it for `devDependencies` you could configure:

```json
"dependencies": {
  "enabled": false
}
```

## enabledManagers

This is a way to "whitelist" certain package managers and disable all others.

By default, as Renovate supports more package managers we enable them once they are stable, but for some people only interested in perhaps npm dependencies, it can feel like "whack-a-mole" to keep disabling new ones you don't want.

This works for both managers (e.g. npm, circleci, nvm, etc) as well as "parent" managers (docker or node).

Example:

```json
{
  "enabledManagers": ["npm"]
}
```

## encrypted

See https://renovatebot.com/docs/private-modules for details on how this is used to encrypt npm tokens.

## engines

Extend this if you wish to configure rules specifically for `engines` definitions. Currently only `node` is supported.

## extends

See https://renovatebot.com/docs/config-presets for details.

## fileMatch

## followTag

The primary use case for this option is if you are following a pre-release tag of a certain dependency, e.g. `typescript` "insiders" build. When it's configured, Renovate bypasses its normal major/minor/patch logic and stable/unstable logic and simply raises a PR if the tag does not match your current version.

## gitlabci

Add to this configuration setting if you need to override any of the GitLab CI default settings. Use the `docker` config object instead if you wish for configuration to apply across all Docker-related package managers.

## golang

Configuration added here applies for all Go-related updates, however currently the only supported package manager for Go is the native Go Modules (`go mod`).

## gomod

Configuration for Go Modules (`go mod`). Supersedes anything in the `go` config object.

## gradle

Configuration for Java gradle projects

## gradle-wrapper

## group

The default configuration for groups are essentially internal to Renovate and you normally shouldn't need to modify them. However, you may choose to _add_ settings to any group by defining your own `group` configuration object.

## groupName

There are multiple cases where it can be useful to group multiple upgrades together. Internally Renovate uses this for branches such as "Pin Dependencies", "Lock File Maintenance", etc. Another example used previously is to group together all related `eslint` packages, or perhaps `angular` or `babel`. To enable grouping, you set the `groupName` field to something non-null.

## groupSlug

By default, Renovate will "slugify" the groupName to determine the branch name. For example if you named your group "All eslint packages" then the branchName would be `renovate/all-eslint-packages`. If you wished to override this then you could set like this:

```json
  "groupName": "eslint packages",
  "groupSlug": "eslint"
```

And then the branchName would be `renovate/eslint` instead.

## hostRules

Example for configuring `docker` auth:

```json
{
  "hostRules": {
    "platform": "docker",
    "username": "<some-username>",
    "password": "<some-password>"
  }
}
```

## ignoreDeprecated

By default, Renovate won't update any packages to deprecated versions unless the package version was _already_ deprecated. The goal of this is to make sure you don't upgrade from a non-deprecated version to a deprecated one just because it's higher than the current version. If for some reason you wish to _force_ deprecated updates on Renovate, you can set `ignoreDeprecated` to `false`, but this is not recommended for most situations.

## ignoreDeps

The `ignoreDeps` configuration field allows you to define a list of dependency names to be ignored by Renovate. Currently it supports only "exact match" dependency names and not any patterns. e.g. to ignore both `eslint` and `eslint-config-base` you would add this to your config:

```json
  "ignoreDeps": ["eslint", "eslint-config-base"]
```

You could also configure this using `packageRules`, especially if you need patterns.

## ignoreNpmrcFile

There may be times where an `.npmrc` file in your repository causes problems, such as during lock file generation. Set this to true and Renovate will ignore any `.npmrc` files it finds.

## ignorePaths

Using this setting, you can selectively ignore package files that you don't want Renovate autodiscovering. For instance if your repository has an "examples" directory of many package.json files that you don't want to be kept up to date.

## ignoreUnstable

By default, Renovate won't update any package versions to unstable versions (e.g. `4.0.0-rc3`) unless the current version has the same major.minor.patch and was _already_ unstable (e.g. it was already on `4.0.0-rc2`). Renovate will not "jump" unstable versions automatically, e.g. if you are on `4.0.0-rc2` and newer versions `4.0.0` and `4.1.0-alpha.1` exist then Renovate will update you to `4.0.0` only. If you need to force permanent unstable updates for a package, you can add a package rule setting `ignoreUnstable` to `false`.

Also check out the `followTag` configuration option above if you wish Renovate to keep you pinned to a particular release tag.

## includeForks

By default, the bot will skip over any repositories that are forked, even if they contain a config file, because that config may have been from the source repository anyway. To enable processing of a forked repository, you need to add `includeForks: true` to your config or run the CLI command with `--include-forks`.

## includePaths

If you wish for Renovate to process only select paths in the repository, use `includePaths`.
If instead you need to just exclude/ignore certain paths then consider `ignorePaths` instead.
If you are more interested in including only certain package managers (e.g. `npm`), then consider `enabledManagers` instead.

## java

Use this configuration option for shared config across all java projects.

## js

Use this configuration option for shared config across npm/yarn/pnpm and meteor package managers.

## kubernetes

Add to this configuration object if you need to override any of the Kubernetes default settings. Use the `docker` config object instead if you wish for configuration to apply across all Docker-related package managers.

It's important to note that the `kubernetes` manager by default has no `fileMatch` defined - i.e. so it will never match any files. This is because there is no commonly accepted file/directory naming convention for Kubernetes yaml files and we don't want to download every single `.yaml` file in repositories just in case one of them has Kubernetes definitions inside.

If most `.yaml` files in your repository are Kubnernetes ones, then you could add this to your config:

```json
{
  "kubernetes": {
    "fileMatch": ["(^|/)[^/]*\\.yaml$"]
  }
}
```

If instead you have them all inside a `k8s/` directory, you would add this:

```json
{
  "kubernetes": {
    "fileMatch": ["k8s/.+\\.yaml$"]
  }
}
```

Or if it's just a single file then something like this:

```json
{
  "kubernetes": {
    "fileMatch": ["^config/k8s.yaml$"]
  }
}
```

## labels

Add an array of 1 or more strings to `labels` and Renovate will apply these labels to any PR its created. Usually these will be a per-repository setting like "renovate", or "ready", or "dependencies", however you can configure them right down to per-package level.

## lazyGrouping

The default behaviour for Renovate is to only use group names for branches and PRs when there's more than one dependency in a group. For example you may have defined a dependency group calls "All eslint packages" with a `packagePattern` of `^eslint`, but if the only upgrade available at the time is `eslint-config-airbnb` then it makes more sense for the PR to be named "Upgrade eslint-config-airbnb to version 2.1.4" than to name it "Upgrade All eslint packages". If ever this behaviour is undesirable then you can override it by setting this option to `false`.

## lockFileMaintenance

By setting enabled=true, this means that the default behaviour is to "maintain" lock files for each `package.json` if they exist already. "Maintaining" a lock file means recreating it to get an up-to-date version and committing that. Supported lock files include `package-lock.json` (npm >= 5) and `yarn.lock` (yarn).

If you wish to disable this feature then you could add this to your configuration:

```json
  "lockFileMaintenance": { "enabled": false }
```

To reduce "noise" in the repository, it defaults its schedule to "before 5am on monday", i.e. to achieve once per week semantics. Renovate may run a few times within that time - even possibly updating the lock file more than once - but it hopefully leaves enough time for tests to run and automerge to apply, if configured.

The `recreateClosed` setting is necessary to tell Renovate to override its default behaviour of never recreating a PR if the same-titled one previously existed, so do not modify this.

`commitMessage`, `prTitle` and `prBody` are custom templates to make sure that the branch and PR have names that make sense. You may override these with your own settings if you prefer.

## major

Add to this object if you wish to define rules that apply only to major updates.

## managerBranchPrefix

This value defaults to empty string, as historically no prefix was necessary for when Renovate was JS-only. Now - for example - we use `docker-` for Docker branches, so they may look like `renovate/docker-ubuntu-16.x`.

## meteor

Set enabled to `true` to enable meteor package updating.

## minor

Add to this object if you wish to define rules that apply only to minor updates.

## node

Using this configuration option allows you to apply common configuration and policies across all Node.js version updates even if managed by different package managers (`npm`, `yarn`, etc.).

Check out our [Node.js documentation](https://renovatebot.com/docs/node) for a comprehensive explanation of how the `node` option can be used.

## npm

## npmToken

See https://renovatebot.com/docs/private-modules for details on how this is used. Typically you would encrypt it and put it inside the `encrypted` object.

## npmrc

See https://renovatebot.com/docs/private-modules for details on how this is used.

## nuget

The `nuget` configuration object is used to control settings for the NuGet package manager. The NuGet package manager supports SDK-style .csproj's, as described [here](https://natemcmaster.com/blog/2017/03/09/vs2015-to-vs2017-upgrade/). This means that .NET Core projects are all supported but any .NET Framework projects need to be updated to the new `.csproj` format in order to be detected and supported by Renovate.

## nvm

For settings common to all node.js version updates (e.g. travis, nvm, etc) you can use the `node` object instead.

## packageRules

`packageRules` is a powerful feature that lets you apply rules to individual packages or to groups of packages using regex pattern matching.

Here is an example if you want to group together all packages starting with `eslint` into a single branch/PR:

```json
"packageRules": [
  {
    "packagePatterns": ["^eslint"],
    "groupName": "eslint packages"
  }
]
```

Note how the above uses `packagePatterns` with a regex value.

Here is an example where you might want to limit the "noisy" package `aws-sdk` to updates just once per week:

```json
  "packageRules": [
    {
      "packageNames": ["aws-sdk"],
      "schedule": ["after 9pm on sunday"]
    }
  ]
```

Note how the above uses `packageNames` instead of `packagePatterns` because it is an exact match package name. This is the equivalent of defining `"packagePatterns": ["^aws\-sdk$"]` and hence much simpler. However you can mix together both `packageNames` and `packagePatterns` in the same package rule and the rule will be applied if _either_ match. Example:

```json
  "packageRules": [
    {
      "packageNames": ["neutrino"],
      "packagePatterns": ["^@neutrino/"],
      "groupName": "neutrino monorepo"
    }
  ]
```

The above rule will group together the `neutrino` package and any package matching `@neutrino/*`.

Path rules are convenient to use if you wish to apply configuration rules to certain package files without needing to configure them all in the `packageFiles` array. For example, if you have an `examples` directory and you want all updates to those examples to use the `chore` prefix instead of `fix`, then you could add this configuration:

```json
  "packageRules": [
    {
      "paths": ["examples/**"],
      "extends": [":semanticCommitTypeAll(chore)"]
    }
  ]
```

### allowedVersions

Use this - usually within a packageRule - to limit how far to upgrade a dependency. For example, if you wish to upgrade to angular v1.5 but not to `angular` v1.6 or higher, you could define this to be `<= 1.5` or `< 1.6.0`:

```
  "packageRules": [{
    "packageNames": ["angular"],
    "allowedVersions": "<=1.5"
  }]
```

### depTypeList

Use this field if you want to limit a `packageRule` to certain `depType` values. Invalid if used outside of a `packageRule`.

### excludePackageNames

**Important**: Do not mix this up with the option `ignoreDeps`. Use `ignoreDeps` instead if all you want to do is have a list of package names for Renovate to ignore.

Use `excludePackageNames` if you want to have one or more exact name matches excluded in your package rule. See also `packageNames`.

```
  "packageRules": [{
    "packagePatterns": ["^eslint"],
    "excludePackageNames": ["eslint-foo"]
  }]
```

The above will match all package names starting with `eslint` but exclude the specific package `eslint-foo`.

### excludePackagePatterns

Use this field if you want to have one or more package name patterns excluded in your package rule. See also `packagePatterns`.

```
  "packageRules": [{
    "packagePatterns": ["^eslint"],
    "excludePackageNames": ["^eslint-foo"]
  }]
```

The above will match all package names starting with `eslint` but exclude ones starting with `eslint-foo`.

### languages

Use this field to restrict rules to a particular language. e.g.

```
  "packageRules": [{
    "packageNames": ["request"],
    "languages": ["python"],
    "enabled": false
  }]
```

### managers

Use this field to restrict rules to a particular package manager. e.g.

```
  "packageRules": [{
    "packageNames": ["node"],
    "managers": ["dockerfile"],
    "enabled": false
  }]
```

### matchCurrentVersion

`matchCurrentVersion` can be an exact semver version or a semver range.

### packageNames

Use this field if you want to have one or more exact name matches in your package rule. See also `excludedPackageNames`.

```
  "packageRules": [{
    "packageNames": ["angular"],
    "rangeStrategy": "pin"
  }]
```

The above will enable set `rangeStrategy` to `pin` only for the package `angular`.

### packagePatterns

Use this field if you want to have one or more package names patterns in your package rule. See also `excludedPackagePatterns`.

```
  "packageRules": [{
    "packageNames": ["^angular"],
    "rangeStrategy": "replace"
  }]
```

The above will set `rangeStrategy` to `replace` for any package starting with `angular`.

### paths

### sourceUrlPrefixes

Here's an example of where you use this to group together all packages from the Vue monorepo:

```json
{
  "packageRules": [{
    "sourceUrlPrefixes": ["https://github.com/vuejs/vue"],
    "groupName" "Vue monorepo packages"
  }]
}
```

Here's an example of where you use this to group together all packages from the `renovatebot` github org:

```json
{
  "packageRules": [{
    "sourceUrlPrefixes": ["https://github.com/renovatebot/"],
    "groupName" "All renovate packages"
  }]
}
```

### updateTypes

Use this field to match rules against types of updates. For example to apply a special label for Major updates:

```
  "packageRules: [{
    "updateTypes": ["major"],
    "labels": ["UPDATE-MAJOR"]
  }]
```

## patch

Add to this object if you wish to define rules that apply only to patch updates. See also `major` and `minor` configuration options.

## php

Warning: PHP Composer support is in alpha stage so you probably only want to run this if you are helping get it feature-ready.

## pin

Add to this object if you wish to define rules that apply only to PRs that pin dependencies.

## pinDigests

If enabled Renovate will pin docker images by means of their sha256 digest and not only by tag so that they are immutable.

## pip_requirements

Add configuration here to specifically override settings for `pip` requirements files. Supports `requirements.txt` and `requirements.pip` files. The default file pattern is fairly flexible in an attempt to catch similarly named ones too but may be extended/changed.

## pip_setup

Add configuration here to specifically override settings for `setup.py` files.

Warning: `setup.py` support is currently in beta, so is not enabled by default. You will need to configure `{ "pip_setup": { "enabled": true }}" to enable.

## pipenv

Add configuration here to change pipenv settings, e.g. to change the file pattern for pipenv so that you can use filenames other than Pipfile.

Warning: 'pipenv' support is currently in beta, so it is not enabled by default. You will need to configure `{ "pipenv": { "enabled": true }}" to enable.

## prBodyColumns

Use this array to provide a list of column names you wish to include in the PR tables.

For example, if you wish to add the package file name to the table, you would add this to your config:

```json
{
  "prBodyColumns": [
    "Package",
    "Update",
    "Type",
    "New value",
    "Package file",
    "References"
  ]
}
```

Note: "Package file" is predefined in the default `prBodyDefinitions` object so does not require a definition before it can be used.

## prBodyDefinitions

You can configure this object to either (a) modify the template for an existing table column in PR bodies, or (b) you wish to _add_ a definition for a new/additional column.

Here is an example of modifying the default value for the "Package" column to put it inside a `<code></code>` block:

```json
  "prBodyDefinitions": {
    "Package": "`{{{depName}}}`"
  }
```

Here is an example of adding a custom "Sourcegraph" column definition:

```json
{
  "prBodyDefinitions": {
    "Sourcegraph": "[![code search for \"{{{depName}}}\"](https://sourcegraph.com/search/badge?q=repo:%5Egithub%5C.com/{{{repository}}}%24+case:yes+-file:package%28-lock%29%3F%5C.json+{{{depName}}}&label=matches)](https://sourcegraph.com/search?q=repo:%5Egithub%5C.com/{{{repository}}}%24+case:yes+-file:package%28-lock%29%3F%5C.json+{{{depName}}})"
  },
  "prBodyColumns": [
    "Package",
    "Update",
    "New value",
    "References",
    "Sourcegraph"
  ]
}
```

Note: Columns must also be included in the `prBodyColumns` array in order to be used, so that's why it's included above in the example.

## prBodyNotes

Use this field to add custom content inside PR bodies, including conditionally.

e.g. if you wish to add an extra Warning to major updates:

```json
{
  "prBodyNotes": ["{{#if isMajor}}:warning: MAJOR MAJOR MAJOR :warning:{{/if}}"]
}
```

## prConcurrentLimit

This setting - if enabled - limits Renovate to a maximum of x concurrent PRs open at any time.

## prCreation

This setting tells Renovate when you would like it to raise PRs:

- `immediate` (default): Renovate will create PRs immediately after creating the corresponding branch
- `not-pending`: Renovate will wait until status checks have completed (passed or failed) before raising the PR
- `status-success`: Renovate won't raise PRs unless tests pass

Renovate defaults to `immediate` but some like to change to `not-pending`. If you set to immediate, it means you will usually get GitHub notifications that a new PR is available but if you view it immediately then it will still have "pending" tests so you can't take any action. With `not-pending`, it means that when you receive the PR notification, you can see if it passed or failed and take action immediately. Therefore you can customise this setting if you wish to be notified a little later in order to reduce "noise".

## prHourlyLimit

This setting - if enabled - helps slow down Renovate, particularly during the onboarding phase. What may happen without this setting is:

1.  Onboarding PR is created
2.  User merges onboarding PR to activate Renovate
3.  Renovate creates a "Pin Dependencies" PR (if necessary)
4.  User merges Pin PR
5.  Renovate then creates every single upgrade PR necessary - potentially dozens

The above can result in swamping CI systems, as well as a lot of retesting if branches need to be rebased every time one is merged. Instead, if `prHourlyLimit` is set to a value like 1 or 2, it will mean that Renovate creates at most that many new PRs within each hourly period (:00-:59). So the project should still result in all PRs created perhaps within the first 24 hours maximum, but at a rate that may allow users to merge them once they pass tests. It does not place a limit on the number of _concurrently open_ PRs - only on the rate they are created.

## prNotPendingHours

If you set `prCreation=not-pending`, then Renovate will wait until tests are non-pending (all pass or at least one fails) before creating PRs. However there are cases where PRs may remain in pending state forever, e.g. absence of tests or status checks that are set to pending indefinitely. Therefore we set an upper limit - default 24 hours - for how long we wait until creating a PR. Note also this is the same length of time as for Renovate's own `unpublishSafe` status check for npm.

## prTitle

The PR title is important for some of Renovate's matching algorithms (e.g. determining whether to recreate a PR or not) so ideally don't modify it much.

## python

Currently the only Python package manager is `pip` - specifically for `requirements.txt` and `requirequirements.pip` files - so adding any config to this `python` object is essentially the same as adding it to the `pip_requirements` object instead.

## rangeStrategy

Behaviour:

- `auto` = Renovate decides (this will be done on a manager-by-manager basis)
- `pin` = convert ranges to exact versions, e.g. `^1.0.0` -> `1.1.0`
- `bump` = e.g. bump the range even if the new version satisifies the existing range, e.g. `^1.0.0` -> `^1.1.0`
- `replace` = Replace the range with a newer one if the new version falls outside it, e.g. `^1.0.0` -> `^2.0.0`
- `widen` = Widen the range with newer one, e.g. `^1.0.0` -> `^1.0.0 || ^2.0.0`
- `update-lockfile` = Update the lock file when in-range updates are available, otherwise 'replace' for updates out of range

Renovate's "auto" strategy works like this for npm:

1.  Always pin `devDependencies`
2.  Pin `dependencies` if we detect that it's an app and not a library
3.  Widen `peerDependencies`
4.  If an existing range already ends with an "or" operator - e.g. `"^1.0.0 || ^2.0.0"` - then Renovate will widen it, e.g. making it into `"^1.0.0 || ^2.0.0 || ^3.0.0"`.
5.  Otherwise, replace the range. e.g. `"^2.0.0"` would be replaced by `"^3.0.0"`

**bump**

By default, Renovate assumes that if you are using ranges then it's because you want them to be wide/open. As such, Renovate won't deliberately "narrow" any range by increasing the semver value inside.

For example, if your `package.json` specifies a value for `left-pad` of `^1.0.0` and the latest version on npmjs is `1.2.0`, then Renovate won't change anything because `1.2.0` satisfies the range. If instead you'd prefer to be updated to `^1.2.0` in cases like this, then set `rangeStrategy` to `bump` in your Renovate config.

This feature supports simple caret (`^`) and tilde (`~`) ranges only, like `^1.0.0` and `~1.0.0`.

## rebaseLabel

On GitHub it is possible to add a label to a PR to manually request Renovate to recreate/rebase it. By default this label is "rebase" however you can configure it to anything you want by changing this `rebaseLabel` field.

## rebaseStalePrs

This field defaults to `null` because it has the potential to create a lot of noise and additional builds to your repository. If you enable it to true, it means each Renovate branch will be updated whenever the base branch has changed. If enabled, this also means that whenever a Renovate PR is merged (whether by automerge or manually via GitHub web) then any other existing Renovate PRs will then need to get rebased and retested.

If you set it to `false` then that will take precedence - it means Renovate will ignore if you have configured the repository for "Require branches to be up to date before merging" in Branch Protection. However if you have configured it to `false` _and_ configured `branch` automerge then Renovate will still rebase as necessary for that.

## recreateClosed

By default, Renovate will detect if it has proposed an update to a project before and not propose the same one again. For example the Webpack 3.x case described above. This field lets you customise this behaviour down to a per-package level. For example we override it to `true` in the following cases where branch names and PR titles need to be reused:

- Package groups
- When pinning versions
- Lock file maintenance

Typically you shouldn't need to modify this setting.

## registryUrls

This is only necessary in case you need to manually configure a registry URL to use for datasource lookups. Applies to PyPI (pip) only for now. Supports only one URL for now but is defined as a list for forward compatibility.

## requiredStatusChecks

This is a future feature that is partially implemented. Currently Renovate's default behaviour is to only automerge if every status check has succeeded. In future, this might be configurable to allow certain status checks to be ignored.

You can still override this to `null` today if your repository doesn't support status checks (i.e. no tests) but you still want to use Renovate anyway.

## respectLatest

Similar to `ignoreUnstable`, this option controls whether to update to versions that are greater than the version tagged as `latest` in the repository. By default, `renovate` will update to a version greater than `latest` only if the current version is itself past latest.

## reviewers

Must be valid usernames. Note: does not currently work with the GitHub App due to an outstanding GitHub API bug.

## rollbackPrs

Set this to false either globally, per-language, or per-package if you want to disable Renovate's behaviour of generating rollback PRs when it can't find the current version on the registry anymore.

## ruby

## schedule

The `schedule` option allows you to define times of week or month for Renovate updates. Running Renovate around the clock may seem too "noisy" for some projects and therefore `schedule` is a good way to reduce the noise by reducing the timeframe in which Renovate will operate on your repository.

The default value for `schedule` is "at any time", which is functionally the same as declaring a `null` schedule. i.e. Renovate will run on the repository around the clock.

The easiest way to define a schedule is to use a preset if one of them fits your requirements. See [Schedule presets](https://renovatebot.com/docs/presets-schedule/) for details and feel free to request a new one in the source repository if you think others would benefit from it too.

Otherwise, here are some text schedules that are known to work:

```
every weekend
before 5:00am
after 10pm and before 5:00am
after 10pm and before 5am every weekday
on friday and saturday
```

One example might be that you don't want Renovate to run during your typical business hours, so that your build machines don't get clogged up testing `package.json` updates. You could then configure a schedule like this at the repository level:

```json
"schedule": ["after 10pm and before 5am on every weekday", "every weekend"]
```

This would mean that Renovate can run for 7 hours each night plus all the time on weekends.

This scheduling feature can also be particularly useful for "noisy" packages that are updated frequently, such as `aws-sdk`.

To restrict `aws-sdk` to only monthly updates, you could add this package rule:

```json
  "packageRules": [
    {
      "packageNames": ["aws-sdk"],
      "extends": ["schedule:monthly"]
    }
  ]
```

Technical details: We mostly rely on the text parsing of the library [later](http://bunkat.github.io/later/parsers.html#text) but only its concepts of "days", "time_before", and "time_after" (Renovate does not support scheduled minutes or "at an exact time" granularity).

## semanticCommitScope

By default you will see angular-style commit prefixes like "chore(deps):". If you wish to change it to something else like "package" then it will look like "chore(package):".

## semanticCommitType

By default you will see angular-style commit prefixes like "chore(deps):". If you wish to change it to something else like "ci" then it will look like "ci(deps):".

## semanticCommits

If you are using a semantic prefix for your commits, then you will want to enable this setting. Although it's configurable to a package-level, it makes most sense to configure it at a repository level. If set to true, then the `semanticPrefix` field will be used for each commit message and PR title.

However, please note that Renovate will autodetect if your repository is already using semantic commits or not and follow suit, so you only really need to configure this if you wish to _override_ Renovate's autodetected setting.

## separateMajorMinor

Renovate's default behaviour is to create a separate branch/PR if both minor and major version updates exist. For example, if you were using Webpack 2.0.0 and versions 2.1.0 and 3.0.0 were both available, then Renovate would create two PRs so that you have the choice whether to apply the minor update to 2.x or the major update of 3.x. If you were to apply the minor update then Renovate would keep updating the 3.x branch for you as well, e.g. if Webpack 3.0.1 or 3.1.0 were released. If instead you applied the 3.0.0 update then Renovate would clean up the unneeded 2.x branch for you on the next run.

It is recommended that you leave this setting to true, because of the polite way that Renovate handles this. For example, let's say in the above example that you decided you wouldn't update to Webpack 3 for a long time and don't want to build/test every time a new 3.x version arrives. In that case, simply close the "Update Webpack to version 3.x" PR and it _won't_ be recreated again even if subsequent Webpack 3.x versions are released. You can continue with Webpack 2.x for as long as you want and receive any updates/patches that are made for it. Then eventually when you do want to update to Webpack 3.x you can make that update to `package.json` yourself and commit it to master once it's tested. After that, Renovate will resume providing you updates to 3.x again! i.e. if you close a major upgrade PR then it won't come back again, but once you make the major upgrade yourself then Renovate will resume providing you with minor or patch updates.

## separateMinorPatch

By default, Renovate won't distinguish between "patch" (e.g. 1.0.x) and "minor" (e.g. 1.x.0) releases - it groups them together. E.g., if you are running version 1.0.0 of a package and both versions 1.0.1 and 1.1.0 are available then Renovate will raise a single PR for version 1.1.0. If you wish to distinguish between patch and minor upgrades, for example if you wish to automerge patch but not minor, then you can set this option to `true`.

## separateMultipleMajor

Set this to true if you wish to receive one PR for every separate major version upgrade of a dependency. e.g. if you are on webpack@v1 currently then default behaviour is a PR for upgrading to webpack@v3 and not for webpack@v2. If this setting is true then you would get one PR for webpack@v2 and one for webpack@v3.

## statusCheckVerify

This feature is added for people migrating from alternative services who are used to seeing a "verify" status check on PRs. If you'd like to use this then go ahead, but otherwise it's more secure to look for Renovate's [GPG Verified Commits](https://github.com/blog/2144-gpg-signature-verification) instead, because those cannot be spoofed by any other person or service (unlike status checks).

## supportPolicy

Language support is limited to those listed below:

- **Node.js** - [Read our Node.js documentation](https://renovatebot.com/docs/node#configuring-support-policy)

## suppressNotifications

Use this field to suppress various types of warnings and other notifications from Renovate. Example:

```json
"suppressNotifications": ["prIgnoreNotification"]
```

The above config will suppress the comment which is added to a PR whenever you close a PR unmerged.

## terraform

Currently Terraform support is limited to Terraform registry sources and github sources that include semver refs, e.g. like `github.com/hashicorp/example?ref=v1.0.0`.

Fixed versions like the following will receive a PR whenever there is a newer version available:

```
module "consul" {
  source  = "hashicorp/consul/aws"
  version = "0.0.5"
  servers = 3
}
```

The following _range_ constraints are also supported:

- `>= 1.2.0`: version 1.2.0 or newer
- `<= 1.2.0`: version 1.2.0 or older
- `~> 1.2.0`: any non-beta version >= 1.2.0 and < 1.3.0, e.g. 1.2.X
- `~> 1.2`: any non-beta version >= 1.2.0 and < 2.0.0, e.g. 1.X.Y
- `>= 1.0.0`, <= 2.0.0`: any version between 1.0.0 and 2.0.0 inclusive

## timezone

It is only recommended to set this field if you wish to use the `schedules` feature and want to write them in your local timezone. Please see the above link for valid timezone names.

## travis

For settings common to all node.js version updates (e.g. travis, nvm, etc) you can use the `node` object instead.

Note: Travis renovation is disabled by default as we cannot be sure of which combination of releases you want until you configure supportPolicy.

## unpublishSafe

It is not known by many that npm package authors and collaborators can _delete_ an npm version if it is less than 24 hours old. e.g. version 1.0.0 might exist, then version 1.1.0 is released, and then version 1.1.0 might get deleted hours later. This means that version 1.1.0 essentially "disappears" and 1.0.0 returns to being the "latest". If you have installed 1.1.0 during that time then your build is essentially broken.

Enabling `unpublishSafe` will add a `renovate/unpublish-safe` status check with value pending to every branch to warn you about this possibility. It can be handy when used with the `prCreation` = `not-pending` configuration option - that way you won't get the PR raised until after a patch is 24 hours old or more.

## unstablePattern

Because Docker uses tags instead of semver, there is no fixed convention for how to identify unstable releases. e.g. some images may use semver convention like `v2.0.0-beta1` but others may use their own convention, like Node.js or Ubuntu even/odd.

This field is currently used by some config prefixes.

## updateLockFiles

## updateNotScheduled

When schedules are in use, it generally means "no updates". However there are cases where updates might be desirable - e.g. if you have set prCreation=not-pending, or you have rebaseStale=true and master branch is updated so you want Renovate PRs to be rebased.

This defaults to true, meaning that Renovate will perform certain "desirable" updates to _existing_ PRs even when outside of schedule. If you wish to disable all updates outside of scheduled hours then set this field to false.

## versionScheme

Usually, each language or package manager has a specific type of "version scheme". e.g. JavaScript uses npm's semver implementation, Python uses pep440, etc. At Renovate we have also implemented some of our own, such as "docker" to address the most common way people tag versions using Docker, and "loose" as a fallback that tries semver first but otherwise just does its best to sort and compare.

By exposing `versionScheme` to config, it allows you to override the default version scheme for a package manager if you really need. In most cases it would not be recommended, but there are some cases such as Docker or Gradle where versioning is not strictly defined and you may need to specify the versioning type per-package.

## vulnerabilityAlerts

Use this object to customise PRs that are raised when vulnerability alerts are detected (GitHub-only). For example, to set custom labels and assignees:

```json
{
  "vulnerabilityAlerts": {
    "labels": ["security"],
    "assignees": ["@rarkins"]
  }
}
```

To disable vulnerability alerts completely, set like this:

```json
{
  "vulnerabilityAlerts": {
    "enabled": false
  }
}
```

## yarnrc
