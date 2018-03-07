---
date: 2017-10-05
title: Configuration Options
categories:
  - configuration-reference
description: Configuration Options usable in renovate.json or package.json
type: Document
order: 0
---

This document describes all the configuration options you may configure in a `renovate.json` file or within a `"renovate"` section of your `package.json`. Note that any config in a `package.json` will apply only to that package file, so this is also one way you can specify different behaviour for different `package.json files`. Similarly, if you have a monorepo and want your config to apply to all package files then you need to define it in a `renovate.json`;

Also, be sure to check out Renovate's [shareable config presets](/docs/configuration-reference/config-presets) to save yourself from reinventing any wheels.

If you have any questions about the below config options, or would like to get help/feedback about a config, please post it as an issue in [renovateapp/config-help](https://github.com/renovateapp/config-help) where it will be promptly answered.

## allowedVersions

A semver range defining allowed versions for dependencies

| name | value  |
| ---- | ------ |
| type | string |

Use this - usually within a packageRule - to limit how far to upgrade a dependency. For example, if you wish to upgrade to angular v1.5 but not to `angular` v1.6 or higher, you could defined this to be `<= 1.5` or `< 1.6.0`:

```
  "packageRules": [{
    "packageNames": ["angular"],
    "allowedVersions": "<=1.5"
  }]
```

## assignees

Assignees for Pull Requests

| name    | value            |
| ------- | ---------------- |
| type    | array of strings |
| default | []               |

Must be valid usernames.

## automerge

Configure if Renovate should merge passing PRs itself..

| name    | value   |
| ------- | ------- |
| type    | boolean |
| default | false   |

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

## automergeType

Type of automerge approach to use.

| name         | value                                        |
| ------------ | -------------------------------------------- |
| type         | string                                       |
| valid values | "branch-merge-commit", "branch-push" or "pr" |
| default      | "pr"                                         |

Renovate will default to automerging after creating PRs, but you can override that to automerge _without_ PRs. There are two ways to merge branch upgrades: merge commits, and branch push.

Merge commits will employ the standard GitHub "merge commit" API, just like when you merge a PR with merge commit setting. The downside of this approach is that you will end up with merge commits and not a nice clean default branch!

Branch push employs GitHub's low-level `git` API to push the Renovate upgrade directly to the head of the base branch (e.g. `master`) to maintain a "clean" history. The downside of this approach is that it implicitly enables the `rebaseStalePrs` setting because otherwise we would risk pushing a bad commit to master. i.e. Renovate won't push the commit to base branch unless the branch is completely up-to-date with `master` and has passed tests, which means that if the default branch is getting updated regularly then it might take several rebases from Renovate until it has a branch commit that is safe to push to `master`.

## baseBranches

An array of one or more custom base branches to be renovated. Default behaviour is to renovate the default repository branch.

| name    | value |
| ------- | ----- |
| type    | list  |
| default | []    |

If left default (empty) then the default branch of the repository is used.

For most projects, this should be left as default. An example use case for using this setting is a project who uses the default `master` branch for releases and a separate branch `next` for preparing for the next release. In that case, the project may prefer for Pull Requests from Renovate to be opened against the `next` branch instead of `master`.

If instead the project needs _both_ `master` and `next` to be renovated, then both should be put into the `baseBranches` array.

It's possible to add this setting into the `renovate.json` file as part of the "Configure Renovate" onboarding PR. If so then Renovate will reflect this setting in its description and use package file contents from the custom base branch instead of default.

## bazel

Configuration specific for bazel WORKSPACE updates.

| name    | value             |
| ------- | ----------------- |
| type    | object            |
| default | { enabled: true } |

## branchName

Branch name template

| name    | value                                                                    |
| ------- | ------------------------------------------------------------------------ |
| type    | handlebars template                                                      |
| default | {% raw %}{{renovatePrefix}}{{depName}}-{{newVersionMajor}}.x{% endraw %} |

It's recommended to use our default templates, but you may override branch name if you really wish. It's recommended to still keep `depName` and `newVersionMajor` in the branch name to make sure all other Renovate features can still work.

Example branch name: `renovate/eslint-4.x`.

## branchPrefix

Prefix to be used for all branch names

| name    | value     |
| ------- | --------- |
| type    | string    |
| default | renovate/ |

You can modify this field if you want to change the prefix used. For example if you want branches to be like `deps/eslint-4.x` instead of `renovate/eslint-4.x` then you set `branchPrefix` = `deps/`. Or if you wish to avoid forward slashes in branch names then you could use `renovate_` instead, for example.

## bumpVersion

Bump the version in the package.json being updated

| name | value  |
| ---- | ------ |
| type | string |

Set this value to 'patch', 'minor' or 'major' to have Renovate update the version in your edited `package.json`. e.g. if you wish Renovate to always increase the target `package.json` version with a patch update, set this to `patch`.

## commitBody

Commit body template

| name    | value  |
| ------- | ------ |
| type    | string |
| default | null   |

This is used whenever a commit "body" is needed, e.g. for adding [skip ci] or DCO signoff.

For example, To add `[skip ci]` to every commit you could configure:

```
  "commitBody": "[skip ci]"
```

## commitMessage

Commit message template

| name    | value                                                                                          |
| ------- | ---------------------------------------------------------------------------------------------- |
| type    | handlebars template                                                                            |
| default | {% raw %}{{semanticPrefix}}Update dependency {{depName}} to version {{newVersion}}{% endraw %} |

The commit message is less important than branchName so you may override it if you wish.

Example commit message: "chore(deps): Update dependency eslint to version 4.0.1"

## copyLocalLibs

| name    | value   |
| ------- | ------- |
| type    | boolean |
| default | false   |

Set to true if repository package.json files contain any local (file) dependencies + lock files. The `package.json` files from each will be copied to disk before lock file generation, even if they are within ignored directories.

## dependencies

Configuration specific for `package.json > dependencies`.

| name    | value                            |
| ------- | -------------------------------- |
| type    | object                           |
| default | {"semanticPrefix": "fix(deps):"} |

Extend this if you wish to configure rules specifically for `dependencies` and not `devDependencies` or `optionalDependencies`.

## description

| name    | value  |
| ------- | ------ |
| type    | string |
| default | null   |

The description field is used by config presets to describe what they do. They are then collated as part of the onboarding description.

## devDependencies

Configuration specific for `package.json > devDependencies`.

| name    | value  |
| ------- | ------ |
| type    | object |
| default | {}     |

Extend this if you wish to configure rules specifically for `devDependencies` and not `dependencies` or `optionalDependencies`.

## digest

Configuration specific for Docker digest pinning.

| name    | value |
| ------- | ----- |
| type    | json  |
| default | {}    |

Add to this object if you wish to define rules that apply only to PRs that pin Docker digests.

## docker

Configuration specific for Dockerfile updates.

| name    | value                                         |
| ------- | --------------------------------------------- |
| type    | object                                        |
| default | { enabled: true, major: { enabled: false }, } |

## enabled

Enable or disable Renovate.

| name    | value   |
| ------- | ------- |
| type    | boolean |
| default | true    |

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

## encrypted

A configuration object containing strings encrypted with Renovate's public key.

| name    | value  |
| ------- | ------ |
| type    | object |
| default | {}     |

See https://renovateapp.com/docs/deep-dives/private-modules for details on how this is used to encrypt npm tokens.

## engines

Configuration specific for `package.json > engines`.

| name    | value  |
| ------- | ------ |
| type    | object |
| default | {}     |

Extend this if you wish to configure rules specifically for `engines` definitions. Currently only `node` is supported.

## excludePackageNames

A list of package names inside a package rule which are to be excluded/ignored.

| name    | value            |
| ------- | ---------------- |
| type    | array of strings |
| default | []               |

Use this field if you want to have one or more exact name matches excluded in your package rule. See also `packageNames`.

## excludePackagePatterns

A list of regex package patterns inside a package rule which are to be excluded/ignored.

| name    | value            |
| ------- | ---------------- |
| type    | array of strings |
| default | []               |

Use this field if you want to have one or more package name patterns excluded in your package rule. See also `packagePatterns`.

## extends

Preset configs to use/extend.

| name    | value            |
| ------- | ---------------- |
| type    | array of strings |
| default | []               |

See https://renovateapp.com/docs/configuration-reference/config-presets for details.

## gitAuthor

| name    | value  |
| ------- | ------ |
| type    | string |
| default | null   |

RFC5322-compliant string if you wish to customise the git author for commits.

## group

Group configuration to apply if groupName is provided.

| name    | value                                                                                                                                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| type    | object                                                                                                                                                                                                                   |
| default | {<br />&nbsp;&nbsp;"recreateClosed": true,<br />&nbsp;&nbsp;"branchName": "template",<br />&nbsp;&nbsp;"commitMessage": "template",<br />&nbsp;&nbsp;"prTitle": "template",<br />&nbsp;&nbsp;"prBody": "template"<br />} |

The default configuration for groups are essentially internal to Renovate and you normally shouldn't need to modify them. However, you may choose to _add_ settings to any group by defining your own `group` configuration object.

## groupName

Human understandable name for a dependency group

| name    | value  |
| ------- | ------ |
| type    | string |
| default | null   |

There are multiple cases where it can be useful to group multiple upgrades together. Internally Renovate uses this for branches such as "Pin Dependencies", "Lock File Maintenance", etc. Another example used previously is to group together all related `eslint` packages, or perhaps `angular` or `babel`. To enable grouping, you set the `groupName` field to something non-null.

## groupSlug

Slug to use in the branch name for groups.

| name    | value  |
| ------- | ------ |
| type    | string |
| default | null   |

By default, Renovate will "slugify" the groupName to determine the branch name. For example if you named your group "All eslint packages" then the branchName would be `renovate/all-eslint-packages`. If you wished to override this then you could set like this:

```json
  "groupName": "eslint packages",
  "groupSlug": "eslint"
```

And then the branchName would be `renovate/eslint` instead.

## ignoreDeps

Dependencies to ignore.

| name    | value            |
| ------- | ---------------- |
| type    | array of strings |
| default | []               |

The `ignoreDeps` configuration field allows you to define a list of dependency names to be ignored by Renovate. Currently it supports only "exact match" dependency names and not any patterns. e.g. to ignore both `eslint` and `eslint-config-base` you would add this to your config:

```json
  "ignoreDeps": ["eslint", "eslint-config-base"]
```

You could also configure this using `packageRules`, especially if you need patterns.

## ignoreNpmrcFile

Ignore npmrc files found in repository

| name    | value   |
| ------- | ------- |
| type    | boolean |
| default | false   |

There may be times where an `.npmrc` file in your repository causes problems, such as during lock file generation. Set this to true and Renovate will ignore any `.npmrc` files it finds.

## ignorePaths

Ignore package files matching any of these paths

| name    | value                                            |
| ------- | ------------------------------------------------ |
| type    | array of strings                                 |
| default | ['**/node_modules/**', '**/bower_components/**'] |

Using this setting, you can selectively ignore package files that you don't want Renovate autodiscovering. For instance if your repository has an "examples" directory of many package.json files that you don't want kept up to date.

## ignoreUnstable

Ignore versions with unstable semver.

| name    | value   |
| ------- | ------- |
| type    | boolean |
| default | true    |

By default, Renovate won't update any packages to unstable versions (e.g. `4.0.0-rc3`) unless the package version was _already_ unstable (e.g. it was already on `4.0.0-rc2`). If for some reason you wish to _force_ unstable updates on Renovate, you can set `ignoreUnstable` to `false`, but this is not recommended for most situations.

## labels

Labels to add to Pull Requests

| name    | value            |
| ------- | ---------------- |
| type    | array of strings |
| default | []               |

Add an array of 1 or more strings to `labels` and Renovate will apply these labels to any PR its created. Usually these will be a per-repository setting like "renovate", or "ready", or "dependencies", however you can configure them right down to per-package level.

## lazyGrouping

Use group names only when more than one upgrade is available.

| name    | value   |
| ------- | ------- |
| type    | boolean |
| default | true    |

The default behaviour for Renovate is to only use group names for branches and PRs when there's more than one dependency in a group. For example you may have defined a dependency group calls "All eslint packages" with a `packagePattern` of `^eslint`, but if the only upgrade available at the time is `eslint-config-airbnb` then it makes more sense for the PR to be named "Upgrade eslint-config-airbnb to version 2.1.4" than to name it "Upgrade All eslint packages". If ever this behaviour is undesirable then you can override it by setting this option to `false`.

## lockFileMaintenance

Configuration for lock file maintenance.

| name    | value                                                                                                                                                           |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| type    | configuration object                                                                                                                                            |
| default | {% raw %}{<br />&nbsp;&nbsp;"enabled": false,<br />&nbsp;&nbsp;"recreateClosed": true,<br />&nbsp;&nbsp;"schedule": ["before 5am on monday"]<br />}{% endraw %} |

By setting enabled=true, this means that the default behaviour is to "maintain" lock files for each `package.json` if they exist already. "Maintaining" a lock file means recreating it to get an up-to-date version and committing that. Supported lock files include `package-lock.json` (npm >= 5) and `yarn.lock` (yarn).

If you wish to disable this feature then you could add this to your configuration:

```json
  "lockFileMaintenance": { "enabled": false }
```

To reduce "noise" in the repository, it defaults its schedule to "before 5am on monday", i.e. to achieve once per week semantics. Renovate may run a few times within that time - even possibly updating the lock file more than once - but it hopefully leaves enough time for tests to run and automerge to apply, if configured.

The `recreateClosed` setting is necessary to tell Renovate to override its default behaviour of never recreating a PR if the same-titled one previously existed, so do not modify this.

`commitMessage`, `prTitle` and `prBody` are custom templates to make sure that the branch and PR have names that make sense. You may override these with your own settings if you prefer.

## major

Configuration specific for major dependency updates.

| name    | value  |
| ------- | ------ |
| type    | object |
| default | {}     |

Add to this object if you wish to define rules that apply only to major updates.

## meteor

Configuration specific for meteor updates.

| name    | value              |
| ------- | ------------------ |
| type    | object             |
| default | { enabled: false } |

Set enabled to `true` to enable meteor package updating.

## minor

Configuration specific for minor dependency updates.

| name    | value  |
| ------- | ------ |
| type    | object |
| default | {}     |

Add to this object if you wish to define rules that apply only to minor updates.

## multipleMajorPrs

| name    | value   |
| ------- | ------- |
| type    | boolean |
| default | false   |

Set this to true if you wish to receive one PR for every separate major version upgrade of a dependency. e.g. if you are on webpack@v1 currently then default behaviour is a PR for upgrading to webpack@v3 and not for webpack@v2. If this setting is true then you would get one PR for webpack@v2 and one for webpack@v3.

## node

Configuration specific for all Node.js version updates (e.g. `engines` field in `package.json`).

| name    | value                                         |
| ------- | --------------------------------------------- |
| type    | object                                        |
| default | { groupName: 'Node.js', lazyGrouping: false } |

Using this configuration option allows you to apply common configuration and policies across all Node.js version updates even if managed by different package managers (`npm`, `yarn`, etc.).

Check out our [Node.js documentation](https://renovateapp.com/docs/language-support/node) for a comprehsneive explanation of how the `node` option can be used.

## npm

Configuration specific for npm dependency updates (`package.json`).

| name    | value             |
| ------- | ----------------- |
| type    | object            |
| default | { enabled: true } |

## npmToken

Your npmjs token.

| name    | value  |
| ------- | ------ |
| type    | string |
| default | null   |

See https://renovateapp.com/docs/deep-dives/private-modules for details on how this is used. Typically you would encrypt it and put it inside the `encrypted` object.

## npmrc

A string copy of npmrc file.

| name    | value  |
| ------- | ------ |
| type    | string |
| default | null   |

See https://renovateapp.com/docs/deep-dives/private-modules for details on how this is used.

## nvm

Configuration specific for `.nvmrc` files.

| name    | value             |
| ------- | ----------------- |
| type    | object            |
| default | { enabled: true } |

For settings common to all node.js version updates (e.g. travis, nvm, etc) you can use the `node` object instead.

## optionalDependencies

Configuration specific for `package.json > optionalDependencies`.

| name    | value  |
| ------- | ------ |
| type    | object |
| default | {}     |

Extend this if you wish to configure rules specifically for `optionalDependencies` and not `dependencies` or `devDependencies`.

## packageFiles

A manually provisioned list of package files to use.

| name    | value            |
| ------- | ---------------- |
| type    | array of strings |
| default | `[]`             |

If left default then package file autodiscovery will be used, so only change this setting if you wish to manually specify a limited set of `package.json` or other package files to renovate.

## packageNames

A list of package names inside a package rule.

| name    | value            |
| ------- | ---------------- |
| type    | array of strings |
| default | []               |

Use this field if you want to have one or more exact name matches in your package rule. See also `excludedPackageNames`.

## packagePatterns

A list of package patterns inside a package rule.

| name    | value            |
| ------- | ---------------- |
| type    | array of strings |
| default | []               |

Use this field if you want to have one or more package names patterns in your package rule. See also `excludedPackagePatterns`.

## packageRules

A list of package rules to apply.

| name    | value                         |
| ------- | ----------------------------- |
| type    | list of configuration objects |
| default | []                            |

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

## patch

Configuration specific for patch dependency updates.

| name    | value                                                                                     |
| ------- | ----------------------------------------------------------------------------------------- |
| type    | object                                                                                    |
| default | { "branchName": "{{branchPrefix}}{{depName}}-{{newVersionMajor}}.{{newVersionMinor}}.x" } |

Add to this object if you wish to define rules that apply only to patch updates. See also `major` and `minor` configuration options.

## pathRules

Apply config on a path-based basis. Consists of a `paths` array plus whatever other configuration objects to apply.

| name    | value |
| ------- | ----- |
| type    | list  |
| default | []    |

Path rules are convenient to use if you wish to apply configuration rules to certain package files without needing to configure them all in the `packageFiles` array. For example, if you have an `examples` directory and you want all updates to those examples to use the `chore` prefix instead of `fix`, then you could add this configuration:

```json
  "pathRules": [
    {
      "paths": ["examples/**"],
      "extends": [":semanticCommitTypeAll(chore)"]
    }
  ]
```

## paths

List of strings or glob patterns to match against package files. Applicable inside pathRules only.

| name    | value |
| ------- | ----- |
| type    | list  |
| default | []    |

## peerDependencies

Configuration specific for `package.json > peerDependencies`.

| name    | value              |
| ------- | ------------------ |
| type    | object             |
| default | {"enabled": false} |

Extend this if you wish to configure rules specifically for `peerDependencies`. Disabled by default.

## pin

Configuration specific for dependency pinning.

| name    | value                                                                                                                                                                               |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| type    | object                                                                                                                                                                              |
| default | {<br />"automerge": true,<br />"unpublishSafe": false,<br />"groupName": "Pin Dependencies",<br />"group": {"prTitle": "{{groupName}}", "semanticPrefix": "refactor(deps):"}<br />} |

Add to this object if you wish to define rules that apply only to PRs that pin dependencies.

## pinDigests

| name    | value   |
| ------- | ------- |
| type    | boolean |
| default | true    |

By default, Renovate will add sha256 digests to Docker source images so that they are then "immutable". Set this to false to continue using only tags to identify source images.

## pinVersions

Whether to convert ranged versions in `package.json` to pinned versions.

| name    | value   |
| ------- | ------- |
| type    | boolean |
| default | true    |

This is a very important feature to consider, because not every repository's requirements are the same. Although Renovate's default value for pinVersions is `true` - i.e. pin versions of all dependencies, there are cases where you may want to keep ranges, for example if your project is a web library that is consumed by others. In that case, you may wish to keep ranges for `dependencies` but pin versions for `devDependencies`, for example.

When creating the onboarding PR, Renovate will try to detect the best setting for `pinVersions` and apply that in the `renovate.json` file. In most cases it will suggest pinning `devDependencies` and ranges for everything else, however if a repository's `package.json` files are flagged as `private` then Renovate will recommend pinning all dependencies.

## prBody

Pull Request body template.

| name    | value                   |
| ------- | ----------------------- |
| type    | handlebars template     |
| default | [too long or inclusion] |

Although the PR body can be customised by you, it might be quite challenging. If you think the Pull Request should include different information or could be formatted better, perhaps try raising an [Issue](https://github.com/renovateapp/renovate/issues) and let us solve it for you and for everyone else too.

## prConcurrentLimit

Limit to a maximum of x concurrent branches/PRs. 0 (default) means no limit.

| name    | value   |
| ------- | ------- |
| type    | integer |
| default | 0       |

This setting - if enabled - limits Renovate to a maximum of x concurrent PRs open at any time.

## prCreation

When to create the PR for a branch.

| name         | value                                        |
| ------------ | -------------------------------------------- |
| type         | string                                       |
| valid values | "immediate", "not-pending", "status-success" |
| default      | "immediate"                                  |

This setting tells Renovate when you would like it to raise PRs:

* `immediate` (default): Renovate will create PRs immediately after creating the corresponding branch
* `not-pending`: Renovate will wait until status checks have completed (passed or failed) before raising the PR
* `status-success`: Renovate won't raise PRs unless tests pass

Renovate defaults to `immediate` but some like to change to `not-pending`. If you set to immediate, it means you will usually get GitHub notifications that a new PR is available but if you view it immediately then it will still have "pending" tests so you can't take any action. With `not-pending`, it means that when you receive the PR notification, you can see if it passed or failed and take action immediately. Therefore you can customise this setting if you wish to be notified a little later in order to reduce "noise".

## prHourlyLimit

Rate limit PRs to maximum x created per hour. 0 (default) means no limit.

| name    | value   |
| ------- | ------- |
| type    | integer |
| default | 0       |

This setting - if enabled - helps slow down Renovate, particularly during the onboarding phase. What may happen without this setting is:

1.  Onboarding PR is created
2.  User merges onboarding PR to activate Renovate
3.  Renovate creates a "Pin Dependencies" PR (if necessary)
4.  User merges Pin PR
5.  Renovate then creates every single upgrade PR necessary - potentially dozens

The above can result in swamping CI systems, as well as a lot of retesting if branches need to be rebased every time one is merged. Instead, if `prHourlyLimit` is set to a value like 1 or 2, it will mean that Renovate creates at most that many new PRs within each hourly period (:00-:59). So the project should still result in all PRs created perhaps within the first 24 hours maximum, but at a rate that may allow users to merge them once they pass tests. It does not place a limit on the number of _concurrently open_ PRs - only on the rate they are created.

## prNotPendingHours

| name    | value   |
| ------- | ------- |
| type    | integer |
| default | 24      |

If you set `prCreation=not-pending`, then Renovate will wait until tests are non-pending (all pass or at least one fails) before creating PRs. However there are cases where PRs may remainin pending state forever, e.g. absence of tests or status checks that are set to pending indefinitely. Therefore we set an upper limit - default 24 hours - for how long we wait until creating a PR. Note also this is the same length of time as for Renovate's own `unpublishSafe` status check for npm.

## prTitle

Pull Request title template

| name    | value                                                                                                                                                                                                                        |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| type    | handlebars template                                                                                                                                                                                                          |
| default | {% raw %}{{semanticPrefix}}{{#if isPin}}Pin{{else}}Update{{/if}} dependency {{depName}} to version {{#if isRange}}{{newVersion}}{{else}}{{#if isMajor}}{{newVersionMajor}}.x{{else}}{{newVersion}}{{/if}}{{/if}}{% endraw %} |

The PR title is important for some of Renovate's matching algorithms (e.g. determining whether to recreate a PR or not) so ideally don't modify it much.

## rebaseStalePrs

Whether to rebase branches that are no longer up-to-date with the base branch.

| name    | value   |
| ------- | ------- |
| type    | boolean |
| default | false   |

This field is defaulted to `false` because it has a potential to create a lot of noise and additional builds to your repository. If you enable it, it means each Renovate branch will be updated whenever the base branch has changed. If enabled, this also means that whenever a Renovate PR is merged (whether by automerge or manually via GitHub web) then any other existing Renovate PRs will then need to get rebased and retested.

## recreateClosed

Recreate PRs even if same ones were closed previously.

| name    | value   |
| ------- | ------- |
| type    | boolean |
| default | false   |

By default, Renovate will detect if it has proposed an update to a project before and not propose the same one again. For example the Webpack 3.x case described above. This field lets you customise this behaviour down to a per-package level. For example we override it to `true` in the following cases where branch names and PR titles need to be reused:

* Package groups
* When pinning versions
* Lock file maintenance

Typically you shouldn't need to modify this setting.

## renovateFork

Whether to renovate a forked repository or not.

| name    | value   |
| ------- | ------- |
| type    | boolean |
| default | false   |

By default, Renovate will skip over any repositories that are forked, even if they contain a `renovate.json`, because that config may have been from the source repository. To enable Renovate on forked repositories, you need to add `renovateFork: true` to your renovate config.

## requiredStatusChecks

List of status checks that must pass before automerging.

| name    | value            |
| ------- | ---------------- |
| type    | array of strings |
| default | []               |

This is a future feature that is partially implemented. Currently Renovate's default behaviour is to only automerge if every status check has succeeded. In future, this might be configurable to allow certain status checks to be ignored.

You can still override this to `null` today if your repository doesn't support status checks (i.e. no tests) but you still want to use Renovate anyway.

## respectLatest

| name    | value   |
| ------- | ------- |
| type    | boolean |
| default | true    |

Similar to `ignoreUnstable`, this option controls whether to update to versions that are greater than the version tagged as `latest` in the repository. By default, `renovate` will update to a version greater than `latest` only if the current version is itself past latest.

## reviewers

Requested reviewers for Pull Requests

| name    | value            |
| ------- | ---------------- |
| type    | array of strings |
| default | []               |

Must be valid usernames. Note: does not currently work with the GitHub App due to an outstanding GitHub API bug.

## schedule

Times of day/week to schedule Renovate updates.

| name    | value            |
| ------- | ---------------- |
| type    | array of strings |
| default | []               |

The `schedule` option allows you to define 1 or more times of week for Renovate updates. Running Renovate around the clock may seem too "noisy" for some projects and therefore `schedule` is a good way to reduce the noise by reducing the timeframe in which Renovate will operate on your repository.

For this we rely on text parsing of the library [later](http://bunkat.github.io/later/parsers.html#text) but only its concepts of "days", "time_before", and "time_after" (Renovate does not support scheduled minutes or "at an exact time" granularity).

Example scheduling:

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

To restrict `aws-sdk` to only weekly updates, you could add this package rule:

```json
  "packageRules": [
    {
      "packageNames": ["aws-sdk"],
      "schedule": ["after 9pm on sunday"]
    }
  ]
```

## semanticCommitScope

Commit scope to use if semantic commits are enabled

| name    | value  |
| ------- | ------ |
| type    | string |
| default | "deps" |

By default you will see angular-style commit prefixes like "chore(deps):". If you wish to change it to something else like "package" then it will look like "chore(package):".

## semanticCommitType

Commit type to use if semantic commits is enabled

| name    | value   |
| ------- | ------- |
| type    | string  |
| default | "chore" |

By default you will see angular-style commit prefixes like "chore(deps):". If you wish to change it to something else like "ci" then it will look like "ci(deps):".

## semanticCommits

Enable semantic commit prefixes for commits and PR titles.

| name    | value   |
| ------- | ------- |
| type    | boolean |
| default | null    |

If you are using a semantic prefix for your commits, then you will want to enable this setting. Although it's configurable to a package-level, it makes most sense to configure it at a repository level. If set to true, then the `semanticPrefix` field will be used for each commit message and PR title.

However, please note that Renovate will autodetect if your repository is already using semantic commits or not and follow suit, so you only really need to configure this if you wish to _override_ Renovate's autodetected setting.

## separateMajorReleases

If set to false, it will upgrade dependencies to latest release only, and not separate major/minor branches.

| name    | value   |
| ------- | ------- |
| type    | boolean |
| default | true    |

Renovate's default behaviour is to create a separate branch/PR if both minor and major version updates exist. For example, if you were using Webpack 2.0.0 and versions 2.1.0 and 3.0.0 were both available, then Renovate would create two PRs so that you have the choice whether to apply the minor update to 2.x or the major update of 3.x. If you were to apply the minor update then Renovate would keep updating the 3.x branch for you as well, e.g. if Webpack 3.0.1 or 3.1.0 were released. If instead you applied the 3.0.0 update then Renovate would clean up the unneeded 2.x branch for you on the next run.

It is recommended that you leave this setting to true, because of the polite way that Renovate handles this. For example, let's say in the above example that you decided you wouldn't update to Webpack 3 for a long time and don't want to build/test every time a new 3.x version arrives. In that case, simply close the "Update Webpack to version 3.x" PR and it _won't_ be recreated again even if subsequent Webpack 3.x versions are released. You can continue with Webpack 2.x for as long as you want and receive any updates/patches that are made for it. Then eventually when you do want to update to Webpack 3.x you can make that update to `package.json` yourself and commit it to master once it's tested. After that, Renovate will resume providing you updates to 3.x again! i.e. if you close a major upgrade PR then it won't come back again, but once you make the major upgrade yourself then Renovate will resume providing you with minor or patch updates.

## separatePatchReleases

If set to true, it will separate minor and patch updates into separate branches.

| name    | value   |
| ------- | ------- |
| type    | boolean |
| default | false   |

By default, Renovate won't distinguish between "patch" (e.g. 1.0.x) and "minor" (e.g. 1.x.0) releases - groups them together. e.g. if you are running version 1.0.0 of a package and both versions 1.0.1 and 1.1.0 are available then Renovate will raise a single PR for version 1.1.0. If you wish to distinguish between patch and minor upgrades, for example if you wish to automerge patch but not minor, then you can set this option to `true`.

## statusCheckVerify

Set a "renovate/verify" status check for all PRs

| name    | value   |
| ------- | ------- |
| type    | boolean |
| default | false   |

This feature is added for people migrating from alternative services who are used to seeing a "verify" status check on PRs. If you'd like to use this then go ahead, but otherwise we recommend it's more secure to look for Renovate's [GPG Verified Commits](https://github.com/blog/2144-gpg-signature-verification) instead, because those cannot be spoofed by any other person or service (unlike status checks).

## supportPolicy

Dependency support policy, e.g. used for deciding whether to use a [Long-term Support](https://en.wikipedia.org/wiki/Long-term_support) version vs non-LTS version, a combination, etc.

| name    | value |
| ------- | ----- |
| type    | list  |
| default | []    |

Language support is limited to those listed below:

* **Node.js** - [Read our Node.js documentation](https://renovateapp.com/docs/language-support/node#configuring-support-policy)

## timezone

[IANA Time Zone](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) for the repository.

| name    | value     |
| ------- | --------- |
| type    | string    |
| default | `Etc/UTC` |

It is only recommended to set this field if you wish to use the `schedules` feature and want to write them in your local timezone. Please see the above link for valid timezone names.

## travis

Configuration specific for `.travis.yml` files.

| name    | value              |
| ------- | ------------------ |
| type    | object             |
| default | { enabled: false } |

For settings common to all node.js version updates (e.g. travis, nvm, etc) you can use the `node` object instead.

Note: Travis renovation is disabled by default as we cannot be sure of which combination of releases you want until you configure supportPolicy.

## unpublishSafe

Set a status check for unpublish-safe upgrades.

| name    | value   |
| ------- | ------- |
| type    | boolean |
| default | false   |

It is not known by many that npm package authors and collaborators can _delete_ an npm version if it is less than 24 hours old. e.g. version 1.0.0 might exist, then version 1.1.0 is released, and then version 1.1.0 might get deleted hours later. This means that version 1.1.0 essentially "disappears" and 1.0.0 returns to being the "latest". If you have installed 1.1.0 during that time then your build is essentially broken.

This setting `unpublishSafe` enabled will add a `renovate/unpublish-safe` status check with value pending to every branch to warn you about this possibility. It can be handy when used with the `prCreation` = `not-pending` configuration option - that way you won't get the PR raised until after a patch is 24 hours old or more.

## unstablePattern

Regex for identifying unstable versions (docker only)

| name    | value  |
| ------- | ------ |
| type    | string |
| default | null   |

Because Docker uses tags instead of semver, there is no fixed convention for how to identify unstable releases. e.g. some images may use semver convention like `v2.0.0-beta1` but others may use their own convention, like Node.js or Ubuntu even/odd.

This field is currently used by some config prefixes.

## updateNotScheduled

Whether to update (but not create) branches when not scheduled.

| name    | value   |
| ------- | ------- |
| type    | boolean |
| default | true    |

When schedules are in use, it generally means "no updates". However there are cases where updates might be desirable - e.g. if you have set prCreation=not-pending, or you have rebaseStale=true and master branch is updated so you want Renovate PRs to be rebased.

This is default true, meaning that Renovate will perform certain "desirable" updates to _existing_ PRs even when outside of schedule. If you wish to disable all updates outside of scheduled hours then set this field to false.

## upgradeInRange

Upgrade ranges to latest version even if latest version satisfies existing range.

| name    | value   |
| ------- | ------- |
| type    | boolean |
| default | false   |

By default, Renovate assumes that if you are using ranges then it's because you want them to be wide/open. As such, Renovate won't deliberately "narrow" the range by increasing the semver value inside.

For example, if your `package.json` specifies a value for `left-pad` of `^1.0.0` and the latest version on npmjs is `1.2.0`, then Renovate won't change anything. If instead you'd prefer to be updated to `^1.2.0` in cases like this, then set `upgradeInRange` to `true` in your Renovate config.

This feature supports simple caret (`^`) and tilde (`~`) ranges only, like `^1.0.0` and `~1.0.0`. It is not compatible with `pinVersions=true`.

## versionStrategy

Strategy for how to modify/update existing versions/semver. Possible values: auto, replace, or widen

| name    | value  |
| ------- | ------ |
| type    | string |
| default | 'auto' |

npm-only.

Renovate's "auto" strategy for updating versions is like this:

1.  If the existing version already ends with an "or" operator - e.g. `"^1.0.0 || ^2.0.0"` - then Renovate will widen it, e.g. making it into `"^1.0.0 || ^2.0.0 || ^3.0.0"`.
2.  Otherwise, replace it. e.g. `"^2.0.0"` would be replaced by `"^3.0.0"`

You can override logic either way, by setting it to `replace` or `widen`. e.g. if the currentVersion is `"^1.0.0 || ^2.0.0"` but you configure `versionStrategy=replace` then the result will be `"^3.0.0"`.

Or for example if you configure all `peerDependencies` with `versionStrategy=widen` and have `"react": "^15.0.0"` as current version then it will be updated to `"react": "^15.0.0 || ^16.0.0"`.

## yarnrc

A string copy of yarnrc file.

| name    | value  |
| ------- | ------ |
| type    | string |
| default | null   |
