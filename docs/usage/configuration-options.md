---
title: Configuration Options
description: Configuration Options usable in renovate.json or package.json
---

# Configuration Options

This document describes all the configuration options you may use in a Renovate configuration file.
Any config you define applies to the whole repository (e.g. if you have a monorepo).

You can store your Renovate configuration file in one of these locations:

1. `renovate.json`
1. `renovate.json5`
1. `.github/renovate.json`
1. `.github/renovate.json5`
1. `.gitlab/renovate.json`
1. `.gitlab/renovate.json5`
1. `.renovaterc`
1. `.renovaterc.json`
1. `.renovaterc.json5`
1. `package.json` _(within a `"renovate"` section)_

<!-- prettier-ignore -->
!!! warning
    Storing the Renovate configuration in a `package.json` file is deprecated and support may be removed in the future.

When Renovate runs on a repository, it tries to find the configuration files in the order listed above.
Renovate stops the search after it finds the first match.

Renovate always uses the config from the repository's default branch, even if that configuration specifies multiple `baseBranches`.
Renovate does not read/override the config from within each base branch if present.

Also, be sure to check out Renovate's [shareable config presets](./config-presets.md) to save yourself from reinventing any wheels.
Shareable config presets only work with the JSON format.

If you have any questions about the config options, or want to get help/feedback about a config, go to the [discussions tab in the Renovate repository](https://github.com/renovatebot/renovate/discussions) and start a new "config help" discussion.
We will do our best to answer your question(s).

A `subtype` in the configuration table specifies what type you're allowed to use within the main element.

If a config option has a `parent` defined, it means it's only allowed to configure it within an object with the parent name, such as `packageRules` or `hostRules`.

When an array or object configuration option is `mergeable`, it means that values inside it will be added to any existing object or array that existed with the same name.

<!-- prettier-ignore -->
!!! note
    Config options with `type=string` are always non-mergeable, so `mergeable=false`.

---

## addLabels

The `labels` field is non-mergeable, meaning that any config setting a list of PR labels will replace any existing list.
If you want to append labels for matched rules, then define an `addLabels` array with one (or more) label strings.
All matched `addLabels` strings will be attached to the PR.

Consider this example:

```json
{
  "labels": ["dependencies"],
  "packageRules": [
    {
      "matchPackagePatterns": ["eslint"],
      "labels": ["linting"]
    },
    {
      "matchDepTypes": ["optionalDependencies"],
      "addLabels": ["optional"]
    }
  ]
}
```

With the above config:

- Optional dependencies will have the labels `dependencies` and `optional`
- ESLint dependencies will have the label `linting`
- All other dependencies will have the label `dependencies`

## additionalBranchPrefix

By default, the value for this config option is an empty string.
Normally you don't need to set this config option.

Here's an example where `additionalBranchPrefix` can help you.
Say you're using a monorepo and want to split pull requests based on the location of the package definition, so that individual teams can manage their own Renovate pull requests.
This can be done with this configuration:

```json
{
  "additionalBranchPrefix": "{{parentDir}}-"
}
```

## additionalReviewers

This option _adds_ to the existing reviewer list, rather than _replacing_ it like `reviewers`.

Use `additionalReviewers` when you want to add to a preset or base list, without replacing the original.
For example, when adding focused reviewers for a specific package group.

## assignAutomerge

By default, Renovate will not assign reviewers and assignees to an automerge-enabled PR unless it fails status checks.
By configuring this setting to `true`, Renovate will instead always assign reviewers and assignees for automerging PRs at time of creation.

## assignees

Must be valid usernames on the platform in use.

## assigneesFromCodeOwners

If enabled Renovate tries to determine PR assignees by matching rules defined in a CODEOWNERS file against the changes in the PR.

See [GitHub](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners) or [GitLab](https://docs.gitlab.com/ee/user/project/code_owners.html) documentation for details on syntax and possible file locations.

## assigneesSampleSize

If configured, Renovate will take a random sample of given size from assignees and assign them only, instead of assigning the entire list of `assignees` you have configured.

## autoApprove

Setting this to `true` will automatically approve the PRs.

You can also configure this using `packageRules` if you want to use it selectively (e.g. per-package).

## autoReplaceGlobalMatch

Setting this to `false` will replace only the first match during replacements updates.

Disabling this is useful for situations where values are repeated within the dependency string, such as when the `currentVersion` is also featured somewhere within the `currentDigest`, but you only want to replace the first instance.

Consider this example:

```dockerfile
FROM java:8@sha256:0e8b2a860
```

```json
{
  "packageRules": [
    {
      "matchPackageNames": ["java"],
      "replacementName": "eclipse-temurin",
      "replacementVersion": "11"
    }
  ]
}
```

With the above replacement scenario, the current dependency has a version of `8`, which also features several times within the digest section.

When using the default `autoReplaceGlobalMatch` configuration, Renovate will try to replace all instances of `8` within the dependency string with the `replacementVersion` value of `11`.
This will replace more than is intended and will be caught during replacement validation steps, resulting in the replacement PR to not be created.

When setting `autoReplaceGlobalMatch` configuration to `false`, Renovate will only replace the first occurrence of `8` and will successfully create a replacement PR.

## automerge

By default, Renovate raises PRs but leaves them to someone or something else to merge them.
By configuring this setting, you allow Renovate to automerge PRs or even branches.
Using automerge reduces the amount of human intervention required.

Usually you won't want to automerge _all_ PRs, for example most people would want to leave major dependency updates to a human to review first.
You could configure Renovate to automerge all but major this way:

```json
{
  "packageRules": [
    {
      "matchUpdateTypes": ["minor", "patch", "pin", "digest"],
      "automerge": true
    }
  ]
}
```

Also note that this option can be combined with other nested settings, such as dependency type.
So for example you could choose to automerge all (passing) `devDependencies` only this way:

```json
{
  "packageRules": [
    {
      "matchDepTypes": ["devDependencies"],
      "automerge": true
    }
  ]
}
```

<!-- prettier-ignore -->
!!! note
    Branches creation follows [`schedule`](#schedule) and the automerge follows [`automergeSchedule`](#automergeschedule).

<!-- prettier-ignore -->
!!! warning "Negative reviews on GitHub block Renovate automerge"
    Renovate won't automerge on GitHub if a PR has a negative review.

<!-- prettier-ignore -->
!!! note
    On Azure there can be a delay between a PR being set as completed by Renovate, and Azure merging the PR / finishing its tasks.
    Renovate tries to delay until Azure is in the expected state, but it will continue if it takes too long.
    In some cases this can result in a dependency not being merged, and a fresh PR being created for the dependency.

## automergeComment

Use this only if you configure `automergeType="pr-comment"`.

Example use:

```json
{
  "automerge": true,
  "automergeType": "pr-comment",
  "automergeComment": "bors: r+"
}
```

## automergeSchedule

Use the `automergeSchedule` option to define times of week or month during which Renovate may automerge its PRs.
The default value for `automergeSchedule` is "at any time", which functions the same as setting a `null` schedule.
To configure this option refer to [`schedule`](#schedule) as the syntax is the same.

## automergeStrategy

The automerge strategy defaults to `auto`, so Renovate decides how to merge pull requests as best it can.
If possible, Renovate follows the merge strategy set on the platform itself for the repository.

If you've set `automerge=true` and `automergeType=pr` for any of your dependencies, then you may choose what automerge strategy Renovate uses by setting the `automergeStrategy` config option.
If you're happy with the default behavior, you don't need to do anything.

You may choose from these values:

- `auto`, Renovate decides how to merge
- `fast-forward`, "fast-forwarding" the main branch reference, no new commits in the resultant tree
- `merge-commit`, create a new merge commit
- `rebase`, rewrite history as part of the merge, but usually keep the individual commits
- `squash`, flatten the commits that are being merged into a single new commit

Platforms may only support _some_ of these merge strategies.

If the chosen automerge strategy is not supported on your platform then Renovate stops automerging.
In that case you'll have to set a supported automerge strategy.

## automergeType

This setting is only applicable if you opt in to configure `automerge` to `true` for any of your dependencies.

Automerging defaults to using Pull Requests (`automergeType="pr"`).
In that case Renovate first creates a branch and associated Pull Request, and then automerges the PR on a subsequent run once it detects the PR's status checks are "green".
If by the next run the PR is already behind the base branch it will be automatically rebased, because Renovate only automerges branches which are up-to-date and green.
If Renovate is scheduled for hourly runs on the repository but commits are made every 15 minutes to the main branch, then an automerge like this will keep getting deferred with every rebase.

<!-- prettier-ignore -->
!!! tip
    If you have no tests but still want Renovate to automerge, you need to add `"ignoreTests": true` to your configuration.

If you prefer that Renovate more silently automerge _without_ Pull Requests at all, you can configure `"automergeType": "branch"`. In this case Renovate will:

- Create the branch, wait for test results
- Rebase it any time it gets out of date with the base branch
- Automerge the branch commit if it's: (a) up-to-date with the base branch, and (b) passing all tests
- As a backup, raise a PR only if either: (a) tests fail, or (b) tests remain pending for too long (default: 24 hours)

The final value for `automergeType` is `"pr-comment"`, intended only for users who already have a "merge bot" such as [bors-ng](https://github.com/bors-ng/bors-ng) and want Renovate to _not_ actually automerge by itself and instead tell `bors-ng` to merge for it, by using a comment in the PR.
If you're not already using `bors-ng` or similar, don't worry about this option.

## azureWorkItemId

When creating a PR in Azure DevOps, some branches can be protected with branch policies to [check for linked work items](https://docs.microsoft.com/en-us/azure/devops/repos/git/branch-policies?view=azure-devops#check-for-linked-work-items).
Creating a work item in Azure DevOps is beyond the scope of Renovate, but Renovate can link an already existing work item when creating PRs.

## baseBranches

By default, Renovate will detect and process only the repository's default branch.
For most projects, this is the expected approach.
Renovate also allows users to explicitly configure `baseBranches`, e.g. for use cases such as:

- You wish Renovate to process only a non-default branch, e.g. `dev`: `"baseBranches": ["dev"]`
- You have multiple release streams you need Renovate to keep up to date, e.g. in branches `main` and `next`: `"baseBranches": ["main", "next"]`
- You want to update your main branch and consistently named release branches, e.g. `main` and `release/<version>`: `"baseBranches": ["main", "/^release\\/.*/"]`

It's possible to add this setting into the `renovate.json` file as part of the "Configure Renovate" onboarding PR.
If so then Renovate will reflect this setting in its description and use package file contents from the custom base branch(es) instead of default.

`baseBranches` supports Regular Expressions that must begin and end with `/`, e.g.:

```json
{
  "baseBranches": ["main", "/^release\\/.*/"]
}
```

You can negate the regex by prefixing it with `!`.
Only use a single negation and do not mix it with other branch names, since all branches are combined with `or`.
With a negation, all branches except those matching the regex will be added to the result:

```json
{
  "baseBranches": ["!/^pre-release\\/.*/"]
}
```

You can also use the special `"$default"` string to denote the repository's default branch, which is useful if you have it in an org preset, e.g.:

```json
{
  "baseBranches": ["$default", "/^release\\/.*/"]
}
```

<!-- prettier-ignore -->
!!! note
    Do _not_ use the `baseBranches` config option when you've set a `forkToken`.
    You may need a `forkToken` when you're using the Forking Renovate app.

## bbUseDefaultReviewers

Configuring this to `true` means that Renovate will detect and apply the default reviewers rules to PRs (Bitbucket only).

## branchConcurrentLimit

By default, Renovate won't enforce any concurrent branch limits.
The `config:recommended` preset that many extend from limits the number of concurrent branches to 10, but in many cases a limit as low as 3 or 5 can be most efficient for a repository.

If you want the same limit for both concurrent branches and concurrent PRs, then set a value for `prConcurrentLimit` and it will be re-used for branch calculations too.
But if you want to allow more concurrent branches than concurrent PRs, you can configure both values (e.g. `branchConcurrentLimit=5` and `prConcurrentLimit=3`).

This limit is enforced on a per-repository basis.

Example config:

```json
{
  "branchConcurrentLimit": 3
}
```

<!-- prettier-ignore -->
!!! warning
    Leaving PRs/branches as unlimited or as a high number increases the time it takes for Renovate to process a repository.
    If you find that Renovate is too slow when rebasing out-of-date branches, decrease the `branchConcurrentLimit`.

If you have too many concurrent branches which rebase themselves each run, Renovate can take a lot of time to rebase.
Solutions:

- Decrease the concurrent branch limit (note: this won't go and delete any existing, so won't have an effect until you either merge or close existing ones manually)
- Remove automerge and/or automatic rebasing (set `rebaseWhen` to `conflicted`). However if you have branch protection saying PRs must be up to date then it's not ideal to remove automatic rebasing

## branchName

<!-- prettier-ignore -->
!!! warning
    We strongly recommended that you avoid configuring this field directly.
    Use at your own risk.

If you truly need to configure this then it probably means either:

- You are hopefully mistaken, and there's a better approach you should use, so open a new "config help" discussion at the [Renovate discussions tab](https://github.com/renovatebot/renovate/discussions) or
- You have a use case we didn't expect, please open a discussion to see if we want to get a feature request from you

## branchNameStrict

If `true`, Renovate removes special characters when slugifying the branch name:

- all special characters are removed
- only alphabetic characters are allowed
- hyphens `-` are used to separate sections

The default `false` behavior will mean that special characters like `.` may end up in the branch name.

## branchPrefix

You can modify this field if you want to change the prefix used.
For example if you want branches to be like `deps/eslint-4.x` instead of `renovate/eslint-4.x` then you configure `branchPrefix` = `deps/`.
Or if you wish to avoid forward slashes in branch names then you could use `renovate_` instead, for example.

`branchPrefix` must be configured at the root of the configuration (e.g. not within any package rule) and is not allowed to use template values.
e.g. instead of `renovate/{{parentDir}}-`, configure the template part in `additionalBranchPrefix`, like `"additionalBranchPrefix": "{{parentDir}}-"`.

<!-- prettier-ignore -->
!!! note
    This setting does not change the default _onboarding_ branch name, i.e. `renovate/configure`.
    If you wish to change that too, you need to also configure the field `onboardingBranch` in your global bot config.

## branchPrefixOld

Renovate uses branch names as part of its checks to see if an update PR was created previously, and already merged or ignored.
If you change `branchPrefix`, then no previously closed PRs will match, which could lead to Renovate recreating PRs in such cases.
Instead, set the old `branchPrefix` value as `branchPrefixOld` to allow Renovate to look for those branches too, and avoid this happening.

## branchTopic

This field is combined with `branchPrefix` and `additionalBranchPrefix` to form the full `branchName`. `branchName` uniqueness is important for dependency update grouping or non-grouping so be cautious about ever editing this field manually.
This is an advance field and it's recommend you seek a config review before applying it.

## bumpVersion

Currently this setting supports `helmv3`, `npm`, `nuget`, `maven` and `sbt` only, so raise a feature request if you have a use for it with other package managers.
Its purpose is if you want Renovate to update the `version` field within your package file any time it updates dependencies within.
Usually this is for automatic release purposes, so that you don't need to add another step after Renovate before you can release a new version.

Configure this value to `"prerelease"`, `"patch"`, `"minor"` or `"major"` to have Renovate update the version in your edited package file.
e.g. if you wish Renovate to always increase the target `package.json` version with a patch update, configure this to `"patch"`.

For `npm` only you can also configure this field to `"mirror:x"` where `x` is the name of a package in the `package.json`.
Doing so means that the `package.json` `version` field will mirror whatever the version is that `x` depended on.
Make sure that version is a pinned version of course, as otherwise it won't be valid.

For `sbt` note that Renovate will update the version string only for packages that have the version string in their project's `built.sbt` file.

## cloneSubmodules

Enabling this option will mean that any detected Git submodules will be cloned at time of repository clone.

Important: private submodules aren't supported by Renovate, unless the underlying `ssh` layer already has the correct permissions.

## commitBody

Configure this if you wish Renovate to add a commit body, otherwise Renovate uses a regular single-line commit.

For example, To add `[skip ci]` to every commit you could configure:

```json
{
  "commitBody": "[skip ci]"
}
```

Another example would be if you want to configure a DCO signoff to each commit.

If you want Renovate to signoff its commits, add the [`:gitSignOff` preset](https://docs.renovatebot.com/presets-default/#gitsignoff) to your `extends` array:

```json
{
  "extends": [":gitSignOff"]
}
```

## commitBodyTable

## commitMessage

<!-- prettier-ignore -->
!!! warning
    We deprecated editing the `commitMessage` directly, and we recommend you stop using this config option.
    Instead use config options like `commitMessageAction`, `commitMessageExtra`, and so on, to create the commit message you want.

## commitMessageAction

This is used to alter `commitMessage` and `prTitle` without needing to copy/paste the whole string.
Actions may be like `Update`, `Pin`, `Roll back`, `Refresh`, etc.
Check out the default value for `commitMessage` to understand how this field is used.

## commitMessageExtra

This is used to alter `commitMessage` and `prTitle` without needing to copy/paste the whole string.
The "extra" is usually an identifier of the new version, e.g. "to v1.3.2" or "to tag 9.2".

## commitMessageLowerCase

With `semanticCommits` pr- and commit-titles will by default (`"auto"`) be converted to all-lowercase.
Set this to `"never"` to leave the titles untouched, allowing uppercase characters in semantic commit titles.

## commitMessagePrefix

This is used to alter `commitMessage` and `prTitle` without needing to copy/paste the whole string.
The "prefix" is usually an automatically applied semantic commit prefix, but it can also be statically configured.

<!-- prettier-ignore -->
!!! note
    Renovate _always_ appends a `:` after the `commitMessagePrefix`.
    For example, if you set `commitMessagePrefix` to `chore`, Renovate turns it into `chore:`.

## commitMessageSuffix

This is used to add a suffix to commit messages.
Usually left empty except for internal use (multiple base branches, and vulnerability alerts).

## commitMessageTopic

You can use `commitMessageTopic` to change the `commitMessage` and `prTitle` without copy/pasting the whole string.
The "topic" usually refers to the dependency being updated, for example: `"dependency react"`.

We recommend you use `matchManagers` and `commitMessageTopic` in a `packageRules` array to set the commit message topic, like this:

```json
{
  "packageRules": [
    {
      "matchManagers": ["github-actions"],
      "commitMessageTopic": "{{depName}}"
    }
  ]
}
```

## composerIgnorePlatformReqs

By default, Renovate will ignore Composer platform requirements as the PHP platform used by Renovate most probably won't match the required PHP environment of your project as configured in your `composer.json` file.

Composer `2.2` and up will be run with `--ignore-platform-req='ext-*' --ignore-platform-req='lib-*'`, which ignores extension and library platform requirements but not the PHP version itself and should work in most cases.

Older Composer versions will be run with `--ignore-platform-reqs`, which means that all platform constraints (including the PHP version) will be ignored by default.
This can result in updated dependencies that are not compatible with your platform.

To customize this behaviour, you can explicitly ignore platform requirements (for example `ext-zip`) by setting them separately in this array.
Each item will be added to the Composer command with `--ignore-platform-req`, resulting in it being ignored during its invocation.
Note that this requires your project to use Composer V2, as V1 doesn't support excluding single platform requirements.
The used PHP version will be guessed automatically from your `composer.json` definition, so `php` should not be added as explicit dependency.

If an empty array is configured, Renovate uses its default behaviour.

Set to `null` (not recommended) to fully omit `--ignore-platform-reqs/--ignore-platform-req` during Composer invocation.
This requires the Renovate image to be fully compatible with your Composer platform requirements in order for the Composer invocation to succeed, otherwise Renovate will fail to create the updated lock file.
The Composer output should inform you about the reasons the update failed.

## confidential

If enabled, all issues created by Renovate are set as confidential, even in a public repository.

<!-- prettier-ignore -->
!!! note
    The Dependency Dashboard issue will also be confidential.
    By default issues created by Renovate are visible to all users.

<!-- prettier-ignore -->
!!! note
    This option is applicable to GitLab only.

## configMigration

If enabled, Renovate raises a pull request when it needs to migrate the Renovate config file.
Renovate only performs `configMigration` on `.json` and `.json5` files.

We're adding new features to Renovate bot often.
Often you can keep using your Renovate config and use the new features right away.
But sometimes you need to update your Renovate configuration.
To help you with this, Renovate will create config migration pull requests, when you enable `configMigration`.

Example:

After we changed the [`baseBranches`](#basebranches) feature, the Renovate configuration migration pull request would make this change:

```diff
{
- "baseBranch": "main"
+ "baseBranches": ["main"]
}
```

<!-- prettier-ignore -->
!!! warning
    The `configMigration` feature writes plain JSON for `.json` files, and JSON5 for `.json5` files.
    Renovate may downgrade JSON5 content to plain JSON.
    When downgrading JSON5 to JSON Renovate may also remove the JSON5 comments.
    This can happen because Renovate wrongly converts JSON5 to JSON, thus removing the comments.

<!-- prettier-ignore -->
!!! note
    When you close a config migration PR, Renovate ignores it forever.
    This also means that Renovate won't create a config migration PR in future.
    If you closed the PR by accident, find the closed PR and re-name the PR title to get a new PR.

## configWarningReuseIssue

Renovate's default behavior is to reuse/reopen a single Config Warning issue in each repository so as to keep the "noise" down.
However for some people this has the downside that the config warning won't be sorted near the top if you view issues by creation date.
Configure this option to `false` if you prefer Renovate to open a new issue whenever there is a config warning.

## constraints

Constraints are used in package managers which use third-party tools to update "artifacts" like lock files or checksum files.
Typically, the constraint is detected automatically by Renovate from files within the repository and there is no need to manually configure it.

Constraints are also used to manually restrict which _datasource_ versions are possible to upgrade to based on their language support.
For now this datasource constraint feature only supports `python`, other compatibility restrictions will be added in the future.

```json
{
  "constraints": {
    "python": "2.7"
  }
}
```

If you need to _override_ constraints that Renovate detects from the repository, wrap it in the `force` object like so:

```json
{
  "force": {
    "constraints": {
      "node": "< 15.0.0"
    }
  }
}
```

<!-- prettier-ignore -->
!!! note
    Make sure not to mix this up with the term `compatibility`, which Renovate uses in the context of version releases, e.g. if a Docker image is `node:12.16.0-alpine` then the `-alpine` suffix represents `compatibility`.

## constraintsFiltering

This option controls whether Renovate filters new releases based on configured or detected `constraints`.
Renovate supports two options:

- `none`: No release filtering (all releases allowed)
- `strict`: If the release's constraints match the package file constraints, then it's included

More advanced filtering options may come in future.

There must be a `constraints` object in your Renovate config, or constraints detected from package files, for this to work.
This feature is limited to `packagist`, `npm`, and `pypi` datasources.

<!-- prettier-ignore -->
!!! warning
    Enabling this feature may result in many package updates being filtered out silently.
    See below for a description of how it works.

When `constraintsFiltering=strict`, the following logic applies:

- Are there `constraints` for this repository, either detected from source or from config?
- Does this package's release declare constraints of its own (e.g. `engines` in Node.js)?
- If so, filter out this release unless the repository constraint is a _subset_ of the release constraint

Here are some examples:

| Your repo engines.node   | Dependency release engines.node | Result   |
| ------------------------ | ------------------------------- | -------- |
| `18`                     | `16 \|\| 18`                    | allowed  |
| `^18.10.0`               | `>=18`                          | allowed  |
| `^16.10.0 \|\| >=18.0.0` | `>= 16.0.0`                     | allowed  |
| `>=16`                   | `16 \|\| 18`                    | filtered |
| `16`                     | `^16.10.0`                      | filtered |

When using with `npm`, we recommend you:

- Use `constraintsFiltering` on `dependencies`, not `devDependencies` (usually you do not need to be strict about development dependencies)
- Do _not_ enable `rollbackPrs` at the same time (otherwise your _current_ version may be rolled back if it's incompatible)

## customDatasources

Use `customDatasources` to fetch releases from APIs or statically hosted sites and Renovate has no own datasource.
These datasources can be referred by `customManagers` or can be used to overwrite default datasources.

For more details see the [`custom` datasource documentation](modules/datasource/custom/index.md).

## customManagers

Use `customManagers`(previously `regexManagers`) entries to configure the custom managers in Renovate.

You can define custom managers to handle:

- Proprietary file formats or conventions
- Popular file formats not yet supported as a manager by Renovate

Currently we only have one custom manager.
The `regex` manager which is based on using Regular Expression named capture groups.

You must have a named capture group matching (e.g. `(?<depName>.*)`) _or_ configure its corresponding template (e.g. `depNameTemplate`) for these fields:

- `datasource`
- `depName`
- `currentValue`

Use named capture group matching _or_ set a corresponding template.
We recommend you use only _one_ of these methods, or you'll get confused.

We recommend that you also tell Renovate what `versioning` to use.
If the `versioning` field is missing, then Renovate defaults to using `semver` versioning.

For more details and examples about it, see our [documentation for the `regex` manager](modules/manager/regex/index.md).
For template fields, use the triple brace `{{{ }}}` notation to avoid Handlebars escaping any special characters.

<!-- prettier-ignore -->
!!! tip
    Look at our [Regex Manager Presets](https://docs.renovatebot.com/presets-regexManagers/), they may have what you need.

### customType

Example:

```json
{
  "customManagers": [
    {
      "customType": "regex",
      "matchStrings": [
        "ENV .*?_VERSION=(?<currentValue>.*) # (?<datasource>.*?)/(?<depName>.*?)\\s"
      ]
    }
  ]
}
```

### matchStrings

Each `matchStrings` must be a valid regular expression, optionally with named capture groups.

Example:

```json
{
  "matchStrings": [
    "ENV .*?_VERSION=(?<currentValue>.*) # (?<datasource>.*?)/(?<depName>.*?)\\s"
  ]
}
```

### matchStringsStrategy

`matchStringsStrategy` controls behavior when multiple `matchStrings` values are provided.
Three options are available:

- `any` (default)
- `recursive`
- `combination`

#### any

Each provided `matchString` will be matched individually to the content of the `packageFile`.
If a `matchString` has multiple matches in a file each will be interpreted as an independent dependency.

As example the following configuration will update all three lines in the Dockerfile.

```json title="renovate.json"
{
  "customManagers": [
    {
      "customType": "regex",
      "fileMatch": ["^Dockerfile$"],
      "matchStringsStrategy": "any",
      "matchStrings": [
        "ENV [A-Z]+_VERSION=(?<currentValue>.*) # (?<datasource>.*?)/(?<depName>.*?)(\\&versioning=(?<versioning>.*?))?\\s",
        "FROM (?<depName>\\S*):(?<currentValue>\\S*)"
      ],
      "datasourceTemplate": "docker"
    }
  ]
}
```

```dockerfile title="Dockerfile"
FROM amd64/ubuntu:18.04
ENV GRADLE_VERSION=6.2 # gradle-version/gradle&versioning=maven
ENV NODE_VERSION=10.19.0 # github-tags/nodejs/node&versioning=node
```

#### recursive

If using `recursive` the `matchStrings` will be looped through and the full match of the last will define the range of the next one.
This can be used to narrow down the search area to prevent multiple matches.
But the `recursive` strategy still allows the matching of multiple dependencies as described below.
All matches of the first `matchStrings` pattern are detected, then each of these matches will be used as basis for the input for the next `matchStrings` pattern, and so on.
If the next `matchStrings` pattern has multiple matches then it will split again.
This process will be followed as long there is a match plus a next `matchingStrings` pattern is available.

Matched groups will be available in subsequent matching layers.

This is an example how this can work.
The first custom manager will only upgrade `grafana/loki` as looks for the `backup` key then looks for the `test` key and then uses this result for extraction of necessary attributes.
But the second custom manager will upgrade both definitions as its first `matchStrings` matches both `test` keys.

```json title="renovate.json"
{
  "customManagers": [
    {
      "customType": "regex",
      "fileMatch": ["^example.json$"],
      "matchStringsStrategy": "recursive",
      "matchStrings": [
        "\"backup\":\\s*{[^}]*}",
        "\"test\":\\s*\\{[^}]*}",
        "\"name\":\\s*\"(?<depName>.*)\"[^\"]*\"type\":\\s*\"(?<datasource>.*)\"[^\"]*\"value\":\\s*\"(?<currentValue>.*)\""
      ],
      "datasourceTemplate": "docker"
    },
    {
      "fileMatch": ["^example.json$"],
      "matchStringsStrategy": "recursive",
      "matchStrings": [
        "\"test\":\\s*\\{[^}]*}",
        "\"name\":\\s*\"(?<depName>.*)\"[^\"]*\"type\":\\s*\"(?<datasource>.*)\"[^\"]*\"value\":\\s*\"(?<currentValue>.*)\""
      ],
      "datasourceTemplate": "docker"
    }
  ]
}
```

```json title="example.json"
{
  "backup": {
    "test": {
      "name": "grafana/loki",
      "type": "docker",
      "value": "1.6.1"
    }
  },
  "setup": {
    "test": {
      "name": "python",
      "type": "docker",
      "value": "3.9.0"
    }
  }
}
```

#### combination

You may use this option to combine the values of multiple lines inside a file.
You can combine multiple lines with `matchStringStrategy` values, but the `combination` approach is less susceptible to white space or line breaks stopping a match.

`combination` can only match _one_ dependency per file.
To update multiple dependencies with `combination` you must define multiple custom managers.

Matched group values will be merged to form a single dependency.

```json title="renovate.json"
{
  "customManagers": [
    {
      "customType": "regex",
      "fileMatch": ["^main.yml$"],
      "matchStringsStrategy": "combination",
      "matchStrings": [
        "prometheus_image:\\s*\"(?<depName>.*)\"\\s*//",
        "prometheus_version:\\s*\"(?<currentValue>.*)\"\\s*//"
      ],
      "datasourceTemplate": "docker"
    },
    {
      "fileMatch": ["^main.yml$"],
      "matchStringsStrategy": "combination",
      "matchStrings": [
        "thanos_image:\\s*\"(?<depName>.*)\"\\s*//",
        "thanos_version:\\s*\"(?<currentValue>.*)\"\\s*//"
      ],
      "datasourceTemplate": "docker"
    }
  ]
}
```

```yaml title="Ansible variable file (YAML)"
prometheus_image: "prom/prometheus"  // a comment
prometheus_version: "v2.21.0" // a comment
------
thanos_image: "prom/prometheus"  // a comment
thanos_version: "0.15.0" // a comment
```

In the above example, each custom manager will match a single dependency each.

### depNameTemplate

If `depName` cannot be captured with a named capture group in `matchString` then it can be defined manually using this field.
It will be compiled using Handlebars and the regex `groups` result.

### extractVersionTemplate

If `extractVersion` cannot be captured with a named capture group in `matchString` then it can be defined manually using this field.
It will be compiled using Handlebars and the regex `groups` result.

### packageNameTemplate

`packageName` is used for looking up dependency versions.
It will be compiled using Handlebars and the regex `groups` result.
It will default to the value of `depName` if left unconfigured/undefined.

### currentValueTemplate

If the `currentValue` for a dependency is not captured with a named group then it can be defined in config using this field.
It will be compiled using Handlebars and the regex `groups` result.

### datasourceTemplate

If the `datasource` for a dependency is not captured with a named group then it can be defined in config using this field.
It will be compiled using Handlebars and the regex `groups` result.

### depTypeTemplate

If `depType` cannot be captured with a named capture group in `matchString` then it can be defined manually using this field.
It will be compiled using Handlebars and the regex `groups` result.

### versioningTemplate

If the `versioning` for a dependency is not captured with a named group then it can be defined in config using this field.
It will be compiled using Handlebars and the regex `groups` result.

### registryUrlTemplate

If the `registryUrls` for a dependency is not captured with a named group then it can be defined in config using this field.
It will be compiled using Handlebars and the regex `groups` result.

### autoReplaceStringTemplate

Allows overwriting how the matched string is replaced.
This allows for some migration strategies.
E.g. moving from one Docker image repository to another one.

```yaml title="helm-values.yaml"
# The image of the service <registry>/<repo>/<image>:<tag>
image: my.old.registry/aRepository/andImage:1.18-alpine
```

```json title="The regex definition"
{
  "customManagers": [
    {
      "customType": "regex",
      "fileMatch": ["values.yaml$"],
      "matchStrings": [
        "image:\\s+(?<depName>my\\.old\\.registry/aRepository/andImage):(?<currentValue>[^\\s]+)"
      ],
      "depNameTemplate": "my.new.registry/aRepository/andImage",
      "autoReplaceStringTemplate": "image: {{{depName}}}:{{{newValue}}}",
      "datasourceTemplate": "docker"
    }
  ]
}
```

This will lead to following update where `1.21-alpine` is the newest version of `my.new.registry/aRepository/andImage`:

```yaml
# The image of the service <registry>/<repo>/<image>:<tag>
image: my.new.registry/aRepository/andImage:1.21-alpine
```

## customizeDashboard

You may use the `customizeDashboard` object to customize the Dependency Dashboard.

Supported fields:

- `repoProblemsHeader`: This field will replace the header of the Repository Problems in the Dependency Dashboard issue.

### defaultRegistryUrlTemplate

This field is used to build a `registryUrl` for the dependency.
It is not needed if either:

- The dependency can be found with the default `registryUrls` of the datasource (e.g. npmjs registry if the datasource is `npm`), or
- The matching groups you specified as part of the matching already include a `registryUrl` group
  As this is a template it can be dynamically set.
  E.g. add the `packageName` as part of the URL:

```json5
{
  customDatasources: {
    foo: {
      defaultRegistryUrlTemplate: 'https://exmaple.foo.bar/v1/{{ packageName }}',
    },
  },
}
```

### format

Defines which format the API is returning.
Currently `json` or `plain` are supported, see the `custom` [datasource documentation](modules/datasource/custom/index.md) for more information.

### transformTemplates

`transformTemplates` is a list of [jsonata rules](https://docs.jsonata.org/simple) which get applied serially.
Use this if the API does not return a Renovate compatible schema.

## defaultRegistryUrls

Override a datasource's default registries with this config option.
The datasources's `customRegistrySupport` value must be `true` for the config option to work.

Default registries are only used when both:

- The manager did not extract any `registryUrls` values, and
- No `registryUrls` values have been applied via config, such as `packageRules`

Think of `defaultRegistryUrls` as a way to specify the "fallback" registries for a datasource, for use when no `registryUrls` are extracted or configured.
Compare that to `registryUrls`, which are a way to _override_ registries.

## dependencyDashboard

Starting from version `v26.0.0` the "Dependency Dashboard" is enabled by default as part of the commonly-used `config:recommended` preset.

To disable the Dependency Dashboard, add the preset `:disableDependencyDashboard` or set `dependencyDashboard` to `false`.

```json
{
  "extends": ["config:recommended", ":disableDependencyDashboard"]
}
```

Configuring `dependencyDashboard` to `true` will lead to the creation of a "Dependency Dashboard" issue within the repository.
This issue has a list of all PRs pending, open, closed (unmerged) or in error.
The goal of this issue is to give visibility into all updates that Renovate is managing.

Examples of what having a Dependency Dashboard will allow you to do:

- View all PRs in one place, rather than having to filter PRs by author
- Rebase/retry multiple PRs without having to open each individually
- Override any rate limiting (e.g. concurrent PRs) or scheduling to force Renovate to create a PR that would otherwise be suppressed
- Recreate an unmerged PR (e.g. for a major update that you postponed by closing the original PR)

<!-- prettier-ignore -->
!!! tip
    Enabling the Dependency Dashboard by itself does _not_ change the "control flow" of Renovate.
    Renovate still creates and manages PRs, and still follows your schedules and rate limits.
    The Dependency Dashboard gives you extra visibility and control over your updates.

## dependencyDashboardApproval

This feature allows you to use Renovate's Dependency Dashboard to force approval of updates before they are created.

By setting `dependencyDashboardApproval` to `true` in config (including within `packageRules`), you can tell Renovate to wait for your approval from the Dependency Dashboard before creating a branch/PR.
You can approve a pending PR by selecting the checkbox in the Dependency Dashboard issue.

<!-- prettier-ignore -->
!!! tip
    When you set `dependencyDashboardApproval` to `true` the Dependency Dashboard issue will be created automatically, you do not need to turn on `dependencyDashboard` explicitly.

You can configure Renovate to wait for approval for:

- all package upgrades
- major, minor, patch level upgrades
- specific package upgrades
- upgrades coming from specific package managers

If you want to approve _all_ upgrades, set `dependencyDashboardApproval` to `true`:

```json
{
  "dependencyDashboardApproval": true
}
```

If you want to require approval for _major_ updates, set `dependencyDashboardApproval` to `true` within a `major` object:

```json
{
  "major": {
    "dependencyDashboardApproval": true
  }
}
```

If you want to approve _specific_ packages, set `dependencyDashboardApproval` to `true` within a `packageRules` entry where you have defined a specific package or pattern.

```json
{
  "packageRules": [
    {
      "matchPackagePatterns": ["^@package-name"],
      "dependencyDashboardApproval": true
    }
  ]
}
```

## dependencyDashboardAutoclose

You can configure this to `true` if you prefer Renovate to close an existing Dependency Dashboard whenever there are no outstanding PRs left.

## dependencyDashboardFooter

## dependencyDashboardHeader

## dependencyDashboardLabels

The labels only get updated when the Dependency Dashboard issue updates its content and/or title.
It is pointless to edit the labels, as Renovate bot restores the labels on each run.

## dependencyDashboardOSVVulnerabilitySummary

Use this option to control if the Dependency Dashboard lists the OSV-sourced CVEs for your repository.
You can choose from:

- `none` (default) do not list any CVEs
- `unresolved` list CVEs that have no fixes
- `all` list all CVEs

This feature is independent of the `osvVulnerabilityAlerts` option.

The source of these CVEs is [OSV.dev](https://osv.dev/).

## dependencyDashboardTitle

Configure this option if you prefer a different title for the Dependency Dashboard.

## description

The description field can be used inside any configuration object to add a human-readable description of the object's config purpose.
Descriptions fields embedded within presets are also collated as part of the onboarding description.

## digest

Add to this object if you wish to define rules that apply only to PRs that update digests.

## draftPR

If you want the PRs created by Renovate to be considered as drafts rather than normal PRs, you could add this property to your `renovate.json`:

```json
{
  "draftPR": true
}
```

This option is evaluated at PR/MR creation time.

<!-- prettier-ignore -->
!!! note
    Forgejo, Gitea and GitLab implement draft status by checking if the PR's title starts with certain strings.
    This means that `draftPR` on Forgejo, Gitea and GitLab are incompatible with the legacy method of triggering Renovate to rebase a PR by renaming the PR to start with `rebase!`.

## enabled

The most common use of `enabled` is if you want to turn Renovate's functionality off, for some reason.

For example, if you wanted to disable Renovate completely on a repository, you could make this your `renovate.json`:

```json
{
  "enabled": false
}
```

To disable Renovate for all `eslint` packages, you can configure a package rule like:

```json
{
  "packageRules": [
    {
      "matchPackagePatterns": ["^eslint"],
      "enabled": false
    }
  ]
}
```

To disable Renovate for npm `devDependencies` but keep it for `dependencies` you could configure:

```json
{
  "packageRules": [
    {
      "matchManagers": ["npm"],
      "matchDepTypes": ["devDependencies"],
      "enabled": false
    }
  ]
}
```

## enabledManagers

This is a way to allow only certain package managers and implicitly disable all others.

Example:

```json
{
  "enabledManagers": ["dockerfile", "npm"]
}
```

To enable custom managers you will need to add `custom.` prefix before their names

Example:

```json
{
  "enabledManagers": ["custom.regex"]
}
```

For the full list of available managers, see the [Supported Managers](modules/manager/index.md#supported-managers) documentation.

## encrypted

Before you put any secrets in your repository configuration, encrypt the secrets.
You can encrypt secrets using either a HTML page, or the CLI.

To encrypt secrets for the Mend Renovate App for github.com with a HTML page, go to [app.renovatebot.com/encrypt](https://app.renovatebot.com/encrypt) and complete the form.
If you're self-hosting Renovate, you may download and edit the form, to use your own PGP public key.

You can also encrypt secrets from the CLI, using the `curl`, `echo`, `jq`, `gpg`, `grep` and `tr` CLI programs.
Here is an example:

```
curl https://app.renovatebot.com/renovate.pgp --output renovate.pgp
echo -n '{"o":"your-organization", "r":"your-repository (optional)", "v":"your-secret-value"}' | jq . -c | gpg --encrypt -a --recipient-file renovate.pgp | grep -v '^----' | tr -d '\n'
```

The above script uses:

- `curl` to download the Mend Renovate hosted app's public key
- `echo` to echo a JSON object into `jq`
- `jq` to validate the JSON and then compact it
- `gpg` to encrypt the contents
- `grep` and `tr` to extract the encrypted payload which we will use

The `jq` step is optional, you can leave it out if you wish.
Its primary value is validating that the string you echo to `gpg` is valid JSON, and compact.

<!-- prettier-ignore -->
!!! note
    Encrypted secrets must have at least an org/group scope, and optionally a repository scope.
    This means that Renovate will check if a secret's scope matches the current repository before applying it, and warn/discard if there is a mismatch.

Encrypted secrets usually have a single organization.
But you may encrypt a secret with more than one organization, for example: `org1,org2`.
This way the secret can be used in both the `org1` and `org2` organizations.

For more information on how to use secrets for private packages, read [Private package support](./getting-started/private-packages.md).

## excludeCommitPaths

Be careful you know what you're doing with this option.
The initial intended use is to allow the user to exclude certain dependencies from being added/removed/modified when "vendoring" dependencies.
Example:

```json
{
  "excludeCommitPaths": ["vendor/golang.org/x/text/**"]
}
```

The above would mean Renovate would not include files matching the above glob pattern in the commit, even if it thinks they should be updated.

## expandCodeOwnersGroups

If configured, Renovate will expand any matching `CODEOWNERS` groups into a full list of group members and assign them individually instead of the group.
This is particularly useful when combined with `assigneesSampleSize` and `assigneesFromCodeOwners`, so that only a subset of the Codeowners are assigned instead of the whole group.

## extends

See [shareable config presets](./config-presets.md) for details.
Learn how to use presets by reading the [Key concepts, Presets](./key-concepts/presets.md#how-to-use-presets) page.

## extractVersion

Only use this config option when the raw version strings from the datasource do not match the expected format that you need in your package file.
You must define a "named capture group" called `version` like in the examples below.

For example, to extract only the major.minor precision from a GitHub release, the following would work:

```json
{
  "packageRules": [
    {
      "matchPackageNames": ["foo"],
      "extractVersion": "^(?<version>v\\d+\\.\\d+)"
    }
  ]
}
```

The above will change a raw version of `v1.31.5` to `v1.31`, for example.

Alternatively, to strip a `release-` prefix:

```json
{
  "packageRules": [
    {
      "matchPackageNames": ["bar"],
      "extractVersion": "^release-(?<version>.*)$"
    }
  ]
}
```

The above will change a raw version of `release-2.0.0` to `2.0.0`, for example.
A similar one could strip leading `v` prefixes:

```json
{
  "packageRules": [
    {
      "matchPackageNames": ["baz"],
      "extractVersion": "^v(?<version>.*)$"
    }
  ]
}
```

## fetchChangeLogs

Use this config option to configure changelogs/release notes fetching.
The available options are:

- `off` - disable changelogs fetching
- `branch` - fetch changelogs while creating/updating branch
- `pr`(default) - fetches changelogs while creating/updating pull-request

Avoid setting `fetchChangeLogs=branch`, because this slows down Renovate.
But if you're embedding changelogs in commit information, you may use `fetchChangeLogs=branch`.

Renovate can fetch changelogs when they are hosted on one of these platforms:

- Bitbucket Cloud
- GitHub (.com and Enterprise Server)
- GitLab (.com and CE/EE)

If you are running on any platform except `github.com`, you need to [configure a Personal Access Token](./getting-started/running.md#githubcom-token-for-release-notes) to allow Renovate to fetch changelogs notes from `github.com`.

<!-- prettier-ignore -->
!!! note
    Renovate can only show changelogs from some platforms and some package managers.
    We're planning improvements so that Renovate can show more changelogs.
    Read [issue 14138 on GitHub](https://github.com/renovatebot/renovate/issues/14138) to get an overview of the planned work.

## fileMatch

`fileMatch` is used by Renovate to know which files in a repository to parse and extract.
`fileMatch` patterns in the user config are added to the default values and do not replace them.
The default `fileMatch` patterns cannot be removed, so if you need to include or exclude specific paths then use the `ignorePaths` or `includePaths` configuration options.

Some `fileMatch` patterns are short, like Renovate's default Go Modules `fileMatch` for example.
Here Renovate looks for _any_ `go.mod` file.
In this case you can probably keep using that default `fileMatch`.

At other times, the possible files is too vague for Renovate to have any default.
For default, Kubernetes manifests can exist in any `*.yaml` file and we don't want Renovate to parse every single YAML file in every repository just in case some of them have a Kubernetes manifest, so Renovate's default `fileMatch` for manager `kubernetes` is actually empty (`[]`) and needs the user to tell Renovate what directories/files to look in.

Finally, there are cases where Renovate's default `fileMatch` is good, but you may be using file patterns that a bot couldn't possibly guess about.
For example, Renovate's default `fileMatch` for `Dockerfile` is `['(^|/|\\.)([Dd]ocker|[Cc]ontainer)file$', '(^|/)([Dd]ocker|[Cc]ontainer)file[^/]*$']`.
This will catch files like `backend/Dockerfile`, `prefix.Dockerfile` or `Dockerfile-suffix`, but it will miss files like `ACTUALLY_A_DOCKERFILE.template`.
Because `fileMatch` is mergeable, you don't need to duplicate the defaults and could add the missing file like this:

```json
{
  "dockerfile": {
    "fileMatch": ["^ACTUALLY_A_DOCKERFILE\\.template$"]
  }
}
```

If you configure `fileMatch` then it must be within a manager object (e.g. `dockerfile` in the above example).
The full list of supported managers can be found [here](modules/manager/index.md#supported-managers).

## filterUnavailableUsers

When this option is enabled PRs are not assigned to users that are unavailable.
This option only works on platforms that support the concept of user availability.
For now, you can only use this option on the GitLab platform.

## followTag

For `followTag` to work, the datasource must support distribution streams or tags, like for example npm does.

The main usecase is to follow a pre-release tag of a dependency, say TypeScripts's `"insiders"` build:

```json
{
  "packageRules": [
    {
      "matchPackageNames": ["typescript"],
      "followTag": "insiders"
    }
  ]
}
```

If you've set a `followTag` then Renovate skips its normal major/minor/patch upgrade logic and stable/unstable consistency logic, and instead keeps your dependency version synced _strictly_ to the version in the tag.

Renovate follows tags _strictly_, this can cause problems when a tagged stream is no longer maintained.
For example: you're following the `next` tag, but later the stream you actually want is called `stable` instead.
If `next` is no longer getting updates, you must switch your `followTag` to `stable` to get updates again.

## forkModeDisallowMaintainerEdits

Use `forkModeDisallowMaintainerEdits` to disallow maintainers from editing Renovate's pull requests when in fork mode.

If GitHub pull requests are created from a [fork repository](https://docs.github.com/en/get-started/quickstart/fork-a-repo), the PR author can decide to allow upstream repository to modify the PR directly.

Allowing maintainers to edit pull requests directly is helpful when Renovate pull requests require more changes.
The reviewer can simply push to the pull request without having to create a new PR. [More details here](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/allowing-changes-to-a-pull-request-branch-created-from-a-fork).

You may decide to disallow edits to Renovate pull requests in order to workaround issues in Renovate where modified fork branches are not deleted properly: [See this issue](https://github.com/renovatebot/renovate/issues/16657).
If this option is enabled, reviewers will need to create a new PR if more changes are needed.

<!-- prettier-ignore -->
!!! note
    This option is only relevant if you set `forkToken`.

## forkProcessing

By default, Renovate skips any forked repositories when in `autodiscover` mode.
It even skips a forked repository that has a Renovate configuration file, because Renovate doesn't know if that file was added by the forked repository.

**Process a fork in `autodiscover` mode`**

If you want Renovate to run on a forked repository when in `autodiscover` mode then:

- Ensure a `renovate.json` config exists with `"forkProcessing": "enabled"` in your repository,
- Or run the CLI command with `--fork-processing=enabled`

**Process a fork in other modes**

If you're running Renovate in some other mode, for example when giving a list of repositories to Renovate, but want to skip forked repositories: set `"forkProcessing": "disabled"` in your _global_ config.

**When using the Mend Renovate App**

The behavior of `forkProcessing` depends on how you allow Renovate to run on your account.

**Renovate runs on all repositories**

If you allow Renovate to run on all your repositories, `forkProcessing` will be `"disabled"`.
To run Renovate on a fork: add `"forkProcessing": "enabled"` to the forked repository's `renovate.json` file.

**Renovate runs on selected repositories**

If you allow Renovate to run on "Selected" repositories, `forkProcessing` will be `"enabled"` for each "Selected" repository.

**Allowed filenames**

Only the `onboardingConfigFileName` (which defaults to `renovate.json`) is supported for `forkProcessing`.
You can't use other filenames because Renovate only checks the default filename when using the Git-hosting platform's API.

## gitAuthor

You can customize the Git author that's used whenever Renovate creates a commit.
The `gitAuthor` option accepts a [RFC5322](https://datatracker.ietf.org/doc/html/rfc5322)-compliant string.
It's recommended to include a name followed by an email address, e.g.

```
Development Bot <dev-bot@my-software-company.com>
```

<!-- prettier-ignore -->
!!! danger
    We strongly recommend that the Git author email you use is unique to Renovate.
    Otherwise, if another bot or human shares the same email and pushes to one of Renovate's branches then Renovate will mistake the branch as unmodified and potentially force push over the changes.

## gitIgnoredAuthors

Specify commit authors ignored by Renovate.

By default, Renovate will treat any PR as modified if another Git author has added to the branch.
When a PR is considered modified, Renovate won't perform any further commits such as if it's conflicted or needs a version update.
If you have other bots which commit on top of Renovate PRs, and don't want Renovate to treat these PRs as modified, then add the other Git author(s) to `gitIgnoredAuthors`.

Example:

```json
{
  "gitIgnoredAuthors": ["some-bot@example.org"]
}
```

## gitLabIgnoreApprovals

Ignore the default project level approval(s), so that Renovate bot can automerge its merge requests, without needing approval(s).
Under the hood, it creates a MR-level approval rule where `approvals_required` is set to `0`.
This option works only when `automerge=true`, `automergeType=pr` or `automergeType=branch`, and `platformAutomerge=true`.
Also, approval rules overriding should not be [prevented in GitLab settings](https://docs.gitlab.com/ee/user/project/merge_requests/approvals/settings.html#prevent-editing-approval-rules-in-merge-requests).

## goGetDirs

By default, Renovate will run `go get -d -t ./...` to update the `go.sum`.
If you need to modify this path, for example in order to ignore directories, you can override the default `./...` value using this option:

```json
{
  "goGetDirs": ["./some-project/", "./tools/..."]
}
```

## group

The default configuration for groups are essentially internal to Renovate and you normally shouldn't need to modify them.
But you may _add_ settings to any group by defining your own `group` configuration object.

## groupName

There are multiple cases where it can be useful to group multiple upgrades together.
Internally Renovate uses this for branches such as "Pin Dependencies", "Lock File Maintenance", etc.
Another example used previously is to group together all related `eslint` packages, or perhaps `angular` or `babel`.
To enable grouping, you configure the `groupName` field to something non-null.

The `groupName` field allows free text and does not have any semantic interpretation by Renovate.
All updates sharing the same `groupName` will be placed into the same branch/PR.
For example, to group all non-major devDependencies updates together into a single PR:

```json
{
  "packageRules": [
    {
      "matchDepTypes": ["devDependencies"],
      "matchUpdateTypes": ["patch", "minor"],
      "groupName": "devDependencies (non-major)"
    }
  ]
}
```

## groupSlug

By default, Renovate will "slugify" the groupName to determine the branch name.
For example if you named your group "devDependencies (non-major)" then the branchName would be `renovate/devdependencies-non-major`.
If you wished to override this then you could configure like this:

```json
{
  "packageRules": [
    {
      "matchDepTypes": ["devDependencies"],
      "matchUpdateTypes": ["patch", "minor"],
      "groupName": "devDependencies (non-major)",
      "groupSlug": "dev-dependencies"
    }
  ]
}
```

As a result of the above, the branchName would be `renovate/dev-dependencies` instead.

<!-- prettier-ignore -->
!!! note
    You shouldn't usually need to configure this unless you really care about your branch names.

## hashedBranchLength

Some code hosting systems have restrictions on the branch name lengths, this option lets you get around these restrictions.
You can set the `hashedBranchLength` option to a number of characters that works for your system and then Renovate will generate branch names with the correct length by hashing `additionalBranchPrefix` and `branchTopic`, and then truncating the hash so that the full branch name (including `branchPrefix`) has the right number of characters.

Example: If you have set `branchPrefix: "deps-"` and `hashedBranchLength: 12` it will result in a branch name like `deps-5bf36ec` instead of the traditional pretty branch name like `deps-react-17.x`.

## hostRules

The primary purpose of `hostRules` is to configure credentials for host authentication.
You tell Renovate how to match against the host you need authenticated, and then you also tell it which credentials to use.

The lookup keys for `hostRules` are: `hostType` and `matchHost`, both of which are optional.

Supported credential fields are `token`, `username`, `password`, `timeout`, `enabled` and `insecureRegistry`.

Example for configuring `docker` auth:

```json
{
  "hostRules": [
    {
      "matchHost": "docker.io",
      "username": "<some-username>",
      "password": "<some-password>"
    }
  ]
}
```

If multiple `hostRules` match a request, then they will be applied in the following order/priority:

1. rules with only `hostType` specified
1. rules with only `matchHost` specified (sorted by `matchHost` length if multiple match)
1. rules with both `matchHost` and `hostType` specified (sorted by `matchHost` length if multiple match)

To disable requests to a particular host, you can configure a rule like:

```json
{
  "hostRules": [
    {
      "matchHost": "registry.npmjs.org",
      "enabled": false
    }
  ]
}
```

A preset alternative to the above is:

```json
{
  "extends": [":disableHost(registry.npmjs.org)"]
}
```

To match specific ports you have to add a protocol to `matchHost`:

```json
{
  "hostRules": [
    {
      "matchHost": "https://domain.com:9118",
      "enabled": false
    }
  ]
}
```

<!-- prettier-ignore -->
!!! warning
    Using `matchHost` without a protocol behaves the same as if you had set no `matchHost` configuration.

<!-- prettier-ignore -->
!!! note
    Disabling a host is only 100% effective if added to self-hosted config.
    Renovate currently still checks its _cache_ for results first before trying to connect, so if a public host is blocked in your repository config (e.g. `renovate.json`) then it's possible you may get cached _results_ from that host if another repository using the same bot has successfully queried for the same dependency recently.

### abortIgnoreStatusCodes

This field can be used to configure status codes that Renovate ignores and passes through when `abortOnError` is set to `true`.
For example to also skip 404 responses then configure the following:

```json
{
  "hostRules": [
    {
      "abortOnError": true,
      "abortIgnoreStatusCodes": [404]
    }
  ]
}
```

<!-- prettier-ignore -->
!!! tip
    This field is _not_ mergeable, so the last-applied host rule takes precedence.

### abortOnError

Use this field to configure Renovate to abort runs for custom hosts.
By default, Renovate will only abort for known public hosts, which has the downside that transient errors for other hosts can cause autoclosing of PRs.

To abort Renovate runs for HTTP failures from _any_ host:

```json
{
  "hostRules": [
    {
      "abortOnError": true
    }
  ]
}
```

To abort Renovate runs for any `docker` datasource failures:

```json
{
  "hostRules": [
    {
      "hostType": "docker",
      "abortOnError": true
    }
  ]
}
```

To abort Renovate for errors for a specific `docker` host:

```json
{
  "hostRules": [
    {
      "matchHost": "docker.company.com",
      "abortOnError": true
    }
  ]
}
```

When this field is enabled, Renovate will abort its run if it encounters either (a) any low-level http error (e.g. `ETIMEDOUT`) or (b) gets a response _not_ matching any of the configured `abortIgnoreStatusCodes` (e.g. `500 Internal Error`);

### authType

You may use the `authType` option to create a custom HTTP `authorization` header.
For `authType` to work, you must also set your own `token`.

Do not set `authType=Bearer`: it's the default setting for Renovate anyway.
Do not set a username or password when you're using `authType`, as `authType` doesn't use usernames or passwords.

An example for npm basic auth with token:

```json
{
  "hostRules": [
    {
      "matchHost": "npm.custom.org",
      "token": "<some-token>",
      "authType": "Basic"
    }
  ]
}
```

This will generate the following header: `authorization: Basic <some-token>`.

To use a bare token in the authorization header (required by e.g. Hex) - use the `authType` "Token-Only":

```json
{
  "hostRules": [
    {
      "matchHost": "https://hex.pm/api/repos/private_repo/",
      "token": "<some-token>",
      "authType": "Token-Only"
    }
  ]
}
```

This will generate the header `authorization: <some-token>`.

### concurrentRequestLimit

Usually the default setting is fine, but you can use `concurrentRequestLimit` to limit the number of concurrent outstanding requests.
You only need to adjust this setting if a datasource is rate limiting Renovate or has problems with the load.
The limit will be set for any host it applies to.

Example config:

```json
{
  "hostRules": [
    {
      "matchHost": "api.github.com",
      "concurrentRequestLimit": 2
    }
  ]
}
```

Use an exact host for `matchHost` and not a domain (e.g. `api.github.com` as shown above and not `github.com`).
Do not combine with `hostType` in the same rule or it won't work.

### maxRequestsPerSecond

In addition to `concurrentRequestLimit`, you can limit the maximum number of requests that can be made per one second.
It can be used to set minimal delay between two requests to the same host.
Fractional values are allowed, e.g. `0.25` means 1 request per 4 seconds.
Default value `0` means no limit.

Example config:

```json
{
  "hostRules": [
    {
      "matchHost": "api.github.com",
      "maxRequestsPerSecond": 2
    }
  ]
}
```

### dnsCache

Enable got [dnsCache](https://github.com/sindresorhus/got/blob/v11.5.2/readme.md#dnsCache) support.
It uses `QuickLRU` with a `maxSize` of `1000`.

### enableHttp2

Enable got [http2](https://github.com/sindresorhus/got/blob/v11.5.2/readme.md#http2) support.

### hostType

`hostType` is another way to filter rules and can be either a platform such as `github` and `bitbucket-server`, or it can be a datasource such as `docker` and `rubygems`.
You usually don't need to configure it in a host rule if you have already configured `matchHost` and only one host type is in use for those, as is usually the case.
`hostType` can help for cases like an enterprise registry that serves multiple package types and has different authentication for each, although it's often the case that multiple `matchHost` rules could achieve the same thing.

### insecureRegistry

Enable this option to allow Renovate to connect to an [insecure Docker registry](https://docs.docker.com/registry/insecure/) that is HTTP only.
This is insecure and is not recommended.

Example:

```json
{
  "hostRules": [
    {
      "matchHost": "reg.insecure.com",
      "insecureRegistry": true
    }
  ]
}
```

### keepalive

If enabled, this allows a single TCP connection to remain open for multiple HTTP(S) requests/responses.

### artifactAuth

You may use this field whenever it is needed to only enable authentication for a specific set of managers.

For example, using this option could be used whenever authentication using Git for private composer packages is already being handled through the use of SSH keys, which results in no need for also setting up authentication using tokens.

```json
{
  "hostRules": [
    {
      "hostType": "gitlab",
      "matchHost": "gitlab.myorg.com",
      "token": "abc123",
      "artifactAuth": ["composer"]
    }
  ]
}
```

Supported artifactAuth and hostType combinations:

| artifactAuth | hostTypes                                   |
| ------------ | ------------------------------------------- |
| `composer`   | `gitlab`, `packagist`, `github`, `git-tags` |

### matchHost

This can be a base URL (e.g. `https://api.github.com`) or a hostname like `github.com` or `api.github.com`.
If the value starts with `http(s)` then it will only match against URLs which start with the full base URL.
Otherwise, it will be matched by checking if the URL's hostname matches the `matchHost` directly or ends with it.
When checking the end of the hostname, a single dot is prefixed to the value of `matchHost`, if one is not already present, to ensure it can only match against whole domain segments.

The `matchHost` URL must be the same as the `registryUrl` set in `.npmrc`, or you'll get authentication issues when the artifacts are updated when yarn or npm runs.

```json
{
  "hostRules": [
    {
      "matchHost": "https://gitlab.myorg.com/api/v4/packages/npm/",
      "token": "abc123"
    }
  ]
}
```

The above corresponds with an `.npmrc` like the following:

```
registry=https://gitlab.myorg.com/api/v4/packages/npm/
```

<!-- prettier-ignore -->
!!! note
    Values containing a URL path but missing a scheme will be prepended with 'https://' (e.g. `domain.com/path` -> `https://domain.com/path`)

### timeout

Use this figure to adjust the timeout for queries.
The default is 60s, which is quite high.
To adjust it down to 10s for all queries, do this:

```json
{
  "hostRules": [
    {
      "timeout": 10000
    }
  ]
}
```

### httpsCertificateAuthority

By default, Renovate uses the curated list of well-known [CA](https://en.wikipedia.org/wiki/Certificate_authority)s by Mozilla.
You may use another Certificate Authority instead, by setting it in the `httpsCertificateAuthority` config option.

### httpsPrivateKey

Specifies the private key in [PEM format](https://en.wikipedia.org/wiki/Privacy-Enhanced_Mail) for mTLS authentication.

<!-- prettier-ignore -->
!!! warning
    Do _not_ put your private key into this field, to avoid losing confidentiality completely.
    You must use [secrets](https://docs.renovatebot.com/self-hosted-configuration/#secrets) to pass it down securely instead.

### httpsCertificate

Specifies the [Certificate chains](https://en.wikipedia.org/wiki/X.509#Certificate_chains_and_cross-certification) in [PEM format](https://en.wikipedia.org/wiki/Privacy-Enhanced_Mail) for mTLS authentication.

## ignoreDeprecated

By default, Renovate won't update a dependency version to a deprecated release unless the current version was _itself_ deprecated.
The goal of this is to make sure you don't upgrade from a non-deprecated version to a deprecated one, only because it's higher than the current version.

If for some reason you wish to _force_ deprecated updates with Renovate, you can configure `ignoreDeprecated` to `false`, which we do not recommend for most situations.

## ignoreDeps

The `ignoreDeps` configuration field allows you to define a list of dependency names to be ignored by Renovate.
Currently it supports only "exact match" dependency names and not any patterns. e.g. to ignore both `eslint` and `eslint-config-base` you would add this to your config:

```json
{
  "ignoreDeps": ["eslint", "eslint-config-base"]
}
```

The above is the same as if you wrote this package rule:

```json
{
  "packageRules": [
    {
      "matchPackageNames": ["eslint", "eslint-config-base"],
      "enabled": false
    }
  ]
}
```

## ignorePaths

Renovate will extract dependencies from every file it finds in a repository, unless that file is explicitly ignored.
With this setting you can selectively ignore package files that would normally be "autodiscovered" and updated by Renovate.

For instance if you have a project with an `"examples/"` directory you wish to ignore:

```json
{
  "ignorePaths": ["**/examples/**"]
}
```

Renovate's default ignore is `node_modules` and `bower_components` only.
If you are extending from the popular `config:recommended` preset then it adds ignore patterns for `vendor`, `examples`, `test(s)` and `fixtures` directories too.

## ignorePlugins

Set this to `true` if running plugins causes problems.
Applicable for Composer only for now.

## ignorePrAuthor

This is usually needed if someone needs to migrate bot accounts, including from the Mend Renovate App to self-hosted.
If `ignorePrAuthor` is configured to true, it means Renovate will fetch the entire list of repository PRs instead of optimizing to fetch only those PRs which it created itself.
You should only want to enable this if you are changing the bot account (e.g. from `@old-bot` to `@new-bot`) and want `@new-bot` to find and update any existing PRs created by `@old-bot`.
It's recommended to revert this setting once that transition period is over and all old PRs are resolved.

## ignorePresets

Use this if you are extending a complex preset but don't want to use every "sub preset" that it includes.
For example, consider this config:

```json
{
  "extends": ["config:recommended"],
  "ignorePresets": [":prHourlyLimit2"]
}
```

It would take the entire `"config:recommended"` preset - which has a lot of sub-presets - but ignore the `":prHourlyLimit2"` rule.

## ignoreReviewers

By default, Renovate does not add assignees or reviewers to PRs which are configured for automerge.
If tests have failed, Renovate then does add them, but only if the assignees and reviewers list is empty.
In the case that a user is automatically added as reviewer (such as Renovate Approve bot) and you want to ignore it for the purpose of this decision, add it to the `ignoreReviewers` list.

```json
{
  "reviewers": ["foo"],
  "ignoreReviewers": ["renovate-approve"]
}
```

## ignoreScripts

Applicable for npm and Composer only for now. Set this to `true` if running scripts causes problems.

## ignoreTests

Currently Renovate's default behavior is to only automerge if every status check has succeeded.

Setting this option to `true` means that Renovate will ignore _all_ status checks.
You can set this if you don't have any status checks but still want Renovate to automerge PRs.
Beware: configuring Renovate to automerge without any tests can lead to broken builds on your base branch, please think again before enabling this!

## ignoreUnstable

By default, Renovate won't update any package versions to unstable versions (e.g. `4.0.0-rc3`) unless the current version has the same `major.minor.patch` and was _already_ unstable (e.g. it was already on `4.0.0-rc2`).
Renovate will also not "jump" unstable versions automatically, e.g. if you are on `4.0.0-rc2` and newer versions `4.0.0` and `4.1.0-alpha.1` exist then Renovate will update you to `4.0.0` only.
If you need to force permanent unstable updates for a package, you can add a package rule setting `ignoreUnstable` to `false`.

Also check out the `followTag` configuration option above if you wish Renovate to keep you pinned to a particular release tag.

## includePaths

If you wish for Renovate to process only select paths in the repository, use `includePaths`.

Alternatively, if you need to _exclude_ certain paths in the repository then consider `ignorePaths` instead.
If you are more interested in including only certain package managers (e.g. `npm`), then consider `enabledManagers` instead.

## internalChecksAsSuccess

By default, internal Renovate checks such as `renovate/stability-days` are not counted towards a branch being "green" or not.
This is primarily to prevent automerge when the only check is a passing Renovate check.

Internal checks will always be counted/considered if they are in pending or failed states.
If there are multiple passing checks for a branch, including non-Renovate ones, then this setting won't make any difference.

Change this setting to `true` if you want to use internal Renovate checks towards a passing branch result.

## internalChecksFilter

This setting determines whether Renovate controls when and how filtering of internal checks are performed, particularly when multiple versions of the same update type are available.
Currently this applies to the `minimumReleaseAge` check only.

- `none`: No filtering will be performed, and the highest release will be used regardless of whether it's pending or not
- `strict`: All pending releases will be filtered. PRs will be skipped unless a non-pending version is available
- `flexible`: Similar to strict, but in the case where all versions are pending then a PR will be created with the highest pending version

The `flexible` mode can result in "flapping" of Pull Requests, for example: a pending PR with version `1.0.3` is first released but then downgraded to `1.0.2` once it passes `minimumReleaseAge`.
We recommend that you use the `strict` mode, and enable the `dependencyDashboard` so that you can see suppressed PRs.

## labels

By default, Renovate won't add any labels to PRs.
If you want Renovate to add labels to PRs it creates then define a `labels` array of one or more label strings.
If you want the same label(s) for every PR then you can configure it at the top level of config.
However you can also fully override them on a per-package basis.

Consider this example:

```json
{
  "labels": ["dependencies"],
  "packageRules": [
    {
      "matchPackagePatterns": ["eslint"],
      "labels": ["linting"]
    }
  ]
}
```

With the above config, every PR raised by Renovate will have the label `dependencies` while PRs containing `eslint`-related packages will instead have the label `linting`.

Renovate only adds labels when it creates the PR, which means:

- If you remove labels which Renovate added, it won't re-apply them
- If you change your config, the new/changed labels are not applied to any open PRs

The `labels` array is non-mergeable, meaning if multiple `packageRules` match then Renovate uses the last value for `labels`.
If you want to add/combine labels, use the `addLabels` config option, which is mergeable.

## lockFileMaintenance

You can use `lockFileMaintenance` to refresh lock files to keep them up-to-date.

When Renovate performs `lockFileMaintenance` it deletes the lock file and runs the relevant package manager.
That package manager creates a new lock file, where all dependency versions are updated to the latest version.
Renovate then commits that lock file to the update branch and creates the lock file update PR.

Supported lock files:

- `.terraform.lock.hcl`
- `Cargo.lock`
- `Chart.lock`
- `composer.lock`
- `flake.lock`
- `Gemfile.lock`
- `gradle.lockfile`
- `jsonnetfile.lock.json`
- `package-lock.json`
- `packages.lock.json`
- `pdm.lock`
- `Pipfile.lock`
- `pnpm-lock.yaml`
- `poetry.lock`
- `pubspec.lock`
- `pyproject.toml`
- `requirements.txt`
- `yarn.lock`

Support for new lock files may be added via feature request.

By default, `lockFileMaintenance` is disabled.
To enable `lockFileMaintenance` add this to your configuration:

```json
{
  "lockFileMaintenance": { "enabled": true }
}
```

To reduce "noise" in the repository, Renovate performs `lockFileMaintenance` `"before 4am on monday"`, i.e. to achieve once-per-week semantics.
Depending on its running schedule, Renovate may run a few times within that time window - even possibly updating the lock file more than once - but it hopefully leaves enough time for tests to run and automerge to apply, if configured.

## major

Add to this object if you wish to define rules that apply only to major updates.

## minimumReleaseAge

This feature used to be called `stabilityDays`.

If this is set _and_ an update has a release timestamp header, then Renovate will check if the set duration has passed.

Note: Renovate will wait for the set duration to pass for each **separate** version.
Renovate does not wait until the package has seen no releases for x time-duration(`minimumReleaseAge`).
`minimumReleaseAge` is not intended to help with slowing down fast releasing project updates.
If you want to slow down PRs for a specific package, setup a custom schedule for that package.
Read [our selective-scheduling help](./noise-reduction.md#selective-scheduling) to learn how to set the schedule.

If the time since the release is less than the set `minimumReleaseAge` a "pending" status check is added to the branch.
If enough days have passed then the "pending" status is removed, and a "passing" status check is added.

Some datasources don't have a release timestamp, in which case this feature is not compatible.
Other datasources may have a release timestamp, but Renovate does not support it yet, in which case a feature request needs to be implemented.

Maven users: you cannot use `minimumReleaseAge` if a Maven source returns unreliable `last-modified` headers.

<!-- prettier-ignore -->
!!! note
    Configuring this option will add a `renovate/stability-days` option to the status checks.

There are a couple of uses for `minimumReleaseAge`:

<!-- markdownlint-disable MD001 -->

#### Suppress branch/PR creation for X days

If you combine `minimumReleaseAge=3 days` and `internalChecksFilter="strict"` then Renovate will hold back from creating branches until 3 or more days have elapsed since the version was released.
We recommend that you set `dependencyDashboard=true` so you can see these pending PRs.

#### Prevent holding broken npm packages

npm packages less than 72 hours (3 days) old can be unpublished, which could result in a service impact if you have already updated to it.
Set `minimumReleaseAge` to `3 days` for npm packages to prevent relying on a package that can be removed from the registry:

```json
{
  "packageRules": [
    {
      "matchDatasources": ["npm"],
      "minimumReleaseAge": "3 days"
    }
  ]
}
```

#### Await X time duration before Automerging

If you enabled `automerge` _and_ `minimumReleaseAge`, it means that PRs will be created immediately but automerging will be delayed until the time-duration has passed.
This works because Renovate will add a "renovate/stability-days" pending status check to each branch/PR and that pending check will prevent the branch going green to automerge.

<!-- markdownlint-enable MD001 -->

## minor

Add to this object if you wish to define rules that apply only to minor updates.

## npmToken

See [Private npm module support](./getting-started/private-packages.md) for details on how this is used.
Typically you would encrypt it and put it inside the `encrypted` object.

## npmrc

See [Private npm module support](./getting-started/private-packages.md) for details on how this is used.

## npmrcMerge

This option exists to provide flexibility about whether `npmrc` strings in config should override `.npmrc` files in the repo, or be merged with them.
In some situations you need the ability to force override `.npmrc` contents in a repo (`npmrcMerge=false`) while in others you might want to simply supplement the settings already in the `.npmrc` (`npmrcMerge=true`).
A use case for the latter is if you are a Renovate bot admin and wish to provide a default token for `npmjs.org` without removing any other `.npmrc` settings which individual repositories have configured (such as scopes/registries).

If `false` (default), it means that defining `config.npmrc` will result in any `.npmrc` file in the repo being overridden and its values ignored.
If configured to `true`, it means that any `.npmrc` file in the repo will have `config.npmrc` prepended to it before running `npm`.

## osvVulnerabilityAlerts

Renovate integrates with [OSV](https://osv.dev/), an open-source vulnerability database, to check if extracted dependencies have known vulnerabilities.
Set `osvVulnerabilityAlerts` to `true` to get pull requests with vulnerability fixes (once they are available).

You will only get OSV-based vulnerability alerts for _direct_ dependencies.
Renovate only queries the OSV database for dependencies that use one of these datasources:

- [`crate`](https://docs.renovatebot.com/modules/datasource/crate/)
- [`go`](https://docs.renovatebot.com/modules/datasource/go/)
- [`hex`](https://docs.renovatebot.com/modules/datasource/hex/)
- [`maven`](https://docs.renovatebot.com/modules/datasource/maven/)
- [`npm`](https://docs.renovatebot.com/modules/datasource/npm/)
- [`nuget`](https://docs.renovatebot.com/modules/datasource/nuget/)
- [`packagist`](https://docs.renovatebot.com/modules/datasource/packagist/)
- [`pypi`](https://docs.renovatebot.com/modules/datasource/pypi/)
- [`rubygems`](https://docs.renovatebot.com/modules/datasource/rubygems/)

## packageRules

`packageRules` is a powerful feature that lets you apply rules to individual packages or to groups of packages using regex pattern matching.

Here is an example if you want to group together all packages starting with `eslint` into a single branch/PR:

```json
{
  "packageRules": [
    {
      "matchPackagePatterns": ["^eslint"],
      "groupName": "eslint packages"
    }
  ]
}
```

Note how the above uses `matchPackagePatterns` with a regex value.

Here's an example config to limit the "noisy" `aws-sdk` package to weekly updates:

```json
{
  "packageRules": [
    {
      "matchPackageNames": ["aws-sdk"],
      "schedule": ["after 9pm on sunday"]
    }
  ]
}
```

For Maven dependencies, the package name is `<groupId:artefactId>`, e.g. `"matchPackageNames": ["com.thoughtworks.xstream:xstream"]`

Note how the above uses `matchPackageNames` instead of `matchPackagePatterns` because it is an exact match package name.
This is the equivalent of defining `"matchPackagePatterns": ["^aws\-sdk$"]`.
However you can mix together both `matchPackageNames` and `matchPackagePatterns` in the same package rule and the rule will be applied if _either_ match.
Example:

```json
{
  "packageRules": [
    {
      "matchPackageNames": ["neutrino"],
      "matchPackagePatterns": ["^@neutrino/"],
      "groupName": "neutrino monorepo"
    }
  ]
}
```

The above rule will group together the `neutrino` package and any package matching `@neutrino/*`.

File name matches are convenient to use if you wish to apply configuration rules to certain package or lock files using patterns.
For example, if you have an `examples` directory and you want all updates to those examples to use the `chore` prefix instead of `fix`, then you could add this configuration:

```json
{
  "packageRules": [
    {
      "matchFileNames": ["examples/**"],
      "extends": [":semanticCommitTypeAll(chore)"]
    }
  ]
}
```

If you wish to limit Renovate to apply configuration rules to certain files in the root repository directory, you have to use `matchFileNames` with a `minimatch` pattern (which can include an exact file name match).
For example you have multiple `package.json` and want to use `dependencyDashboardApproval` only on the root `package.json`:

```json
{
  "packageRules": [
    {
      "matchFileNames": ["package.json"],
      "dependencyDashboardApproval": true
    }
  ]
}
```

<!-- prettier-ignore -->
!!! tip
    Renovate evaluates all `packageRules` and does not stop after the first match.
    Order your `packageRules` so the least important rules are at the _top_, and the most important rules at the _bottom_.
    This way important rules override settings from earlier rules if needed.

<!-- prettier-ignore -->
!!! warning
    Avoid nesting any `object`-type configuration in a `packageRules` array, such as a `major` or `minor` block.

### allowedVersions

Use this - usually within a packageRule - to limit how far to upgrade a dependency.
For example, if you wish to upgrade to Angular v1.5 but not to `angular` v1.6 or higher, you could define this to be `<= 1.5` or `< 1.6.0`:

```json
{
  "packageRules": [
    {
      "matchPackageNames": ["angular"],
      "allowedVersions": "<=1.5"
    }
  ]
}
```

The valid syntax for this will be calculated at runtime because it depends on the versioning scheme, which is itself dynamic.

This field also supports Regular Expressions if they begin and end with `/`.
For example, the following will enforce that only 3 or 4-part versions are supported, without any prefixes:

```json
{
  "packageRules": [
    {
      "matchPackageNames": ["com.thoughtworks.xstream:xstream"],
      "allowedVersions": "/^[0-9]+\\.[0-9]+\\.[0-9]+(\\.[0-9]+)?$/"
    }
  ]
}
```

This field also supports a special negated regex syntax for ignoring certain versions.
Use the syntax `!/ /` like the following:

```json
{
  "packageRules": [
    {
      "matchPackageNames": ["chalk"],
      "allowedVersions": "!/java$/"
    }
  ]
}
```

### matchDepTypes

Use this field if you want to limit a `packageRule` to certain `depType` values.
Invalid if used outside of a `packageRule`.

### excludeDepNames

### excludeDepPatterns

### excludePackageNames

**Important**: Do not mix this up with the option `ignoreDeps`.
Use `ignoreDeps` instead if all you want to do is have a list of package names for Renovate to ignore.

Use `excludePackageNames` if you want to have one or more exact name matches excluded in your package rule.
See also `matchPackageNames`.

```json
{
  "packageRules": [
    {
      "matchPackagePatterns": ["^eslint"],
      "excludePackageNames": ["eslint-foo"]
    }
  ]
}
```

The above will match all package names starting with `eslint` but exclude the specific package `eslint-foo`.

### excludePackagePatterns

Use this field if you want to have one or more package name patterns excluded in your package rule.
See also `matchPackagePatterns`.

```json
{
  "packageRules": [
    {
      "matchPackagePatterns": ["^eslint"],
      "excludePackagePatterns": ["^eslint-foo"]
    }
  ]
}
```

The above will match all package names starting with `eslint` but exclude ones starting with `eslint-foo`.

### excludePackagePrefixes

Use this field if you want to have one or more package name prefixes excluded in your package rule, without needing to write a regex.
See also `matchPackagePrefixes`.

```json
{
  "packageRules": [
    {
      "matchPackagePrefixes": ["eslint"],
      "excludePackagePrefixes": ["eslint-foo"]
    }
  ]
}
```

The above will match all package names starting with `eslint` but exclude ones starting with `eslint-foo`.

### excludeRepositories

Use this field to restrict rules to a particular repository. e.g.

```json
{
  "packageRules": [
    {
      "excludeRepositories": ["literal/repo", "/^some/.*$/", "**/*-archived"],
      "enabled": false
    }
  ]
}
```

This field supports Regular Expressions if they begin and end with `/`, otherwise it will use `minimatch`.

### matchCategories

Use `matchCategories` to restrict rules to a particular language or group.
Matching is done using "any" logic, i.e. "match any of the following categories".
The categories can be found in the [manager documentation](modules/manager/index.md).

<!-- prettier-ignore -->
!!! note
    Rules with `matchCategories` are only applied _after_ extraction of dependencies.
    If you want to configure which managers are being extracted at all, use `enabledManagers` instead.

```json
{
  "packageRules": [
    {
      "matchCategories": ["python"],
      "addLabels": ["py"]
    }
  ]
}
```

### matchRepositories

Use this field to restrict rules to a particular repository. e.g.

```json
{
  "packageRules": [
    {
      "matchRepositories": ["literal/repo", "/^some/.*$/", "**/*-archived"],
      "enabled": false
    }
  ]
}
```

This field supports Regular Expressions if they begin and end with `/`, otherwise it will use `minimatch`.

### matchBaseBranches

Use this field to restrict rules to a particular branch. e.g.

```json
{
  "packageRules": [
    {
      "matchBaseBranches": ["main"],
      "excludePackagePatterns": ["^eslint"],
      "enabled": false
    }
  ]
}
```

This field also supports Regular Expressions if they begin and end with `/`. e.g.

```json
{
  "packageRules": [
    {
      "matchBaseBranches": ["/^release/.*/"],
      "excludePackagePatterns": ["^eslint"],
      "enabled": false
    }
  ]
}
```

### matchManagers

Use this field to restrict rules to a particular package manager. e.g.

```json
{
  "packageRules": [
    {
      "matchPackageNames": ["node"],
      "matchManagers": ["dockerfile"],
      "enabled": false
    }
  ]
}
```

For the full list of available managers, see the [Supported Managers](modules/manager/index.md#supported-managers) documentation.

### matchDatasources

Use this field to restrict rules to a particular datasource. e.g.

```json
{
  "packageRules": [
    {
      "matchDatasources": ["orb"],
      "labels": ["circleci-orb!!"]
    }
  ]
}
```

### matchCurrentValue

This option is matched against the `currentValue` field of a dependency.

`matchCurrentValue` supports Regular Expressions which must begin and end with `/`.
For example, the following enforces that only `1.*` versions will be used:

```json
{
  "packageRules": [
    {
      "matchPackagePatterns": ["io.github.resilience4j"],
      "matchCurrentValue": "/^1\\./"
    }
  ]
}
```

This field also supports a special negated regex syntax to ignore certain versions.
Use the syntax `!/ /` like this:

```json
{
  "packageRules": [
    {
      "matchPackagePatterns": ["io.github.resilience4j"],
      "matchCurrentValue": "!/^0\\./"
    }
  ]
}
```

### matchCurrentVersion

The `currentVersion` field will be one of the following (in order of preference):

- locked version if a lock file exists
- resolved version
- current value

Consider using instead `matchCurrentValue` if you wish to match against the raw string value of a dependency.

`matchCurrentVersion` can be an exact version or a version range:

```json
{
  "packageRules": [
    {
      "matchCurrentVersion": ">=1.0.0",
      "matchPackageNames": ["angular"]
    }
  ]
}
```

The syntax of the version range must follow the [versioning scheme](modules/versioning.md#supported-versioning) used by the matched package(s).
This is usually defined by the [manager](modules/manager/index.md#supported-managers) which discovered them or by the default versioning for the package's [datasource](modules/datasource/index.md).
For example, a Gradle package would typically need Gradle constraint syntax (e.g. `[,7.0)`) and not SemVer syntax (e.g. `<7.0`).

This field also supports Regular Expressions which must begin and end with `/`.
For example, the following enforces that only `1.*` versions will be used:

```json
{
  "packageRules": [
    {
      "matchPackagePatterns": ["io.github.resilience4j"],
      "matchCurrentVersion": "/^1\\./"
    }
  ]
}
```

This field also supports a special negated regex syntax to ignore certain versions.
Use the syntax `!/ /` like this:

```json
{
  "packageRules": [
    {
      "matchPackagePatterns": ["io.github.resilience4j"],
      "matchCurrentVersion": "!/^0\\./"
    }
  ]
}
```

### matchFileNames

Renovate will compare `matchFileNames` glob matching against the dependency's package file and also lock file if one exists.

The following example matches `package.json` but _not_ `package/frontend/package.json`:

```json
{
  "packageRules": [
    {
      "matchFileNames": ["package.json"],
      "labels": ["npm"]
    }
  ]
}
```

The following example matches any `package.json`, including files like `backend/package.json`:

```json
{
  "packageRules": [
    {
      "description": "Group dependencies from package.json files",
      "matchFileNames": ["**/package.json"],
      "groupName": "All package.json changes"
    }
  ]
}
```

The following example matches any file in directories starting with `app/`:

```json
{
  "packageRules": [
    {
      "description": "Group all dependencies from the app directory",
      "matchFileNames": ["app/**"],
      "groupName": "App dependencies"
    }
  ]
}
```

It is recommended that you avoid using "negative" globs, like `**/!(package.json)`, because such patterns might still return true if they match against the lock file name (e.g. `package-lock.json`).

### matchDepNames

### matchDepPatterns

### matchPackageNames

Use this field if you want to have one or more exact name matches in your package rule.
See also `excludePackageNames`.

```json
{
  "packageRules": [
    {
      "matchPackageNames": ["angular"],
      "rangeStrategy": "pin"
    }
  ]
}
```

The above will configure `rangeStrategy` to `pin` only for the package `angular`.

### matchPackagePatterns

Use this field if you want to have one or more package names patterns in your package rule.
See also `excludePackagePatterns`.

```json
{
  "packageRules": [
    {
      "matchPackagePatterns": ["^angular"],
      "rangeStrategy": "replace"
    }
  ]
}
```

The above will configure `rangeStrategy` to `replace` for any package starting with `angular`.

### matchPackagePrefixes

Use this field to match a package prefix without needing to write a regex expression.
See also `excludePackagePrefixes`.

```json
{
  "packageRules": [
    {
      "matchPackagePrefixes": ["angular"],
      "rangeStrategy": "replace"
    }
  ]
}
```

Like the earlier `matchPackagePatterns` example, the above will configure `rangeStrategy` to `replace` for any package starting with `angular`.

`matchPackagePrefixes` will match against `packageName` first, and then `depName`, however `depName` matching is deprecated and will be removed in a future major release.
If matching against `depName`, use `matchDepPatterns` instead.

### matchSourceUrlPrefixes

Here's an example of where you use this to group together all packages from the `renovatebot` GitHub org:

```json
{
  "packageRules": [
    {
      "matchSourceUrlPrefixes": ["https://github.com/renovatebot/"],
      "groupName": "All renovate packages"
    }
  ]
}
```

### matchSourceUrls

Here's an example of where you use this to group together all packages from the Vue monorepo:

```json
{
  "packageRules": [
    {
      "matchSourceUrls": ["https://github.com/vuejs/vue"],
      "groupName": "Vue monorepo packages"
    }
  ]
}
```

### matchUpdateTypes

Use `matchUpdateTypes` to match rules against types of updates.
For example to apply a special label to `major` updates:

```json
{
  "packageRules": [
    {
      "matchUpdateTypes": ["major"],
      "labels": ["UPDATE-MAJOR"]
    }
  ]
}
```

<!-- prettier-ignore -->
!!! warning
    Packages that follow SemVer are allowed to make breaking changes in _any_ `0.x` version, even `patch` and `minor`.
    Check if you're using any `0.x` package, and see if you need custom `packageRules` for it.
    When setting up automerge for dependencies, make sure to stop accidental automerges of `0.x` versions.
    Read the [automerge non-major updates](./key-concepts/automerge.md#automerge-non-major-updates) docs for a config example that blocks `0.x` updates.

### matchConfidence

<!-- prettier-ignore -->
!!! warning
    This configuration option needs a Mend API key, and is in private beta testing only.
    API keys are not available for free or via the `renovatebot/renovate` repository.

```json title="Grouping high merge confidence updates"
{
  "packageRules": [
    {
      "matchConfidence": ["high", "very high"],
      "groupName": "high merge confidence"
    }
  ]
}
```

Tokens can be configured via `hostRules` using the `"merge-confidence"` `hostType`:

```json
{
  "hostRules": [
    {
      "hostType": "merge-confidence",
      "token": "********"
    }
  ]
}
```

### customChangelogUrl

Use this field to set the source URL for a package, including overriding an existing one.
Source URLs are necessary in order to look up changelogs.

Using this field we can specify the exact URL to fetch changelogs from.

```json title="Setting the source URL for the dummy package"
{
  "packageRules": [
    {
      "matchPackageNames": ["dummy"],
      "customChangelogUrl": "https://github.com/org/dummy"
    }
  ]
}
```

<!-- prettier-ignore -->
!!! note
    Renovate can fetch changelogs from Bitbucket, Gitea (Forgejo), GitHub and GitLab platforms only, and setting the URL to an unsupported host/platform type won't change that.

### replacementName

This config option only works with some managers.
We're working to support more managers, subscribe to issue [renovatebot/renovate#14149](https://github.com/renovatebot/renovate/issues/14149) to follow our progress.

Managers which do not support replacement:

- `bazel`
- `git-submodules`
- `gomod`
- `gradle`
- `hermit`
- `homebrew`
- `maven`
- `regex`
- `sbt`

Use the `replacementName` config option to set the name of a replacement package.

Can be used in combination with `replacementVersion`.

You can suggest a new community package rule by editing [the `replacements.ts` file on the Renovate repository](https://github.com/renovatebot/renovate/blob/main/lib/config/presets/internal/replacements.ts) and opening a pull request.

### replacementNameTemplate

<!-- prettier-ignore -->
!!! note
    `replacementName` will take precedence if used within the same package rule.

Use the `replacementNameTemplate` config option to control the replacement name.

Use the triple brace `{{{ }}}` notation to avoid Handlebars escaping any special characters.

For example, the following package rule can be used to replace the registry for `docker` images:

```json
{
  "packageRules": [
    {
      "matchDatasources": ["docker"],
      "matchPackagePatterns": ["^docker\\.io/.+"],
      "replacementNameTemplate": "{{{replace 'docker\\.io/' 'ghcr.io/' packageName}}}"
    }
  ]
}
```

Or, to add a registry prefix to any `docker` images that do not contain an explicit registry:

```json
{
  "packageRules": [
    {
      "description": "official images",
      "matchDatasources": ["docker"],
      "matchPackagePatterns": ["^[a-z-]+$"],
      "replacementNameTemplate": "some.registry.org/library/{{{packageName}}}"
    },
    {
      "description": "non-official images",
      "matchDatasources": ["docker"],
      "matchPackagePatterns": ["^[a-z-]+/[a-z-]+$"],
      "replacementNameTemplate": "some.registry.org/{{{packageName}}}"
    }
  ]
}
```

### replacementVersion

This config option only works with some managers.
We're working to support more managers, subscribe to issue [renovatebot/renovate#14149](https://github.com/renovatebot/renovate/issues/14149) to follow our progress.
For a list of managers which do not support replacement read the `replacementName` config option docs.

Use the `replacementVersion` config option to set the version of a replacement package.
Must be used with `replacementName`.
For example to replace the npm package `jade` with version `2.0.0` of the package `pug`:

```json
{
  "packageRules": [
    {
      "matchDatasources": ["npm"],
      "matchPackageNames": ["jade"],
      "replacementName": "pug",
      "replacementVersion": "2.0.0"
    }
  ]
}
```

## patch

Add to this object if you wish to define rules that apply only to patch updates.

## pin

Add to this object if you wish to define rules that apply only to PRs that pin dependencies.

## pinDigest

Add to this object if you wish to define rules that apply only to PRs that pin digests.

## pinDigests

If enabled Renovate will pin Docker images or GitHub Actions by means of their SHA256 digest and not only by tag so that they are immutable.

## platformAutomerge

<!-- prettier-ignore -->
!!! note
    If you use the default `platformAutomerge=true` then you should enable your Git hosting platform's capabilities to enforce test passing before PR merge.
    If you don't do this, the platform might merge Renovate PRs even if the repository's tests haven't started, are in still in progress, or possibly even when they have failed.
    On GitHub this is called "Require status checks before merging", which you can find in the "Branch protection rules" section of the settings for your repository.
    [GitHub docs, about protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)
    [GitHub docs, require status checks before merging](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches#require-status-checks-before-merging)
    If you're using another platform, search their documentation for a similar feature.

If you have enabled `automerge` and set `automergeType=pr` in the Renovate config, then leaving `platformAutomerge` as `true` speeds up merging via the platform's native automerge functionality.

Renovate tries platform-native automerge only when it initially creates the PR.
Any PR that is being updated will be automerged with the Renovate-based automerge.

`platformAutomerge` will configure PRs to be merged after all (if any) branch policies have been met.
This option is available for Azure, Gitea, GitHub and GitLab.
It falls back to Renovate-based automerge if the platform-native automerge is not available.

You can also fine-tune the behavior by setting `packageRules` if you want to use it selectively (e.g. per-package).

Note that the outcome of `rebaseWhen=auto` can differ when `platformAutomerge=true`.
Normally when you set `rebaseWhen=auto` Renovate rebases any branch that's behind the base branch automatically, and some people rely on that.
This behavior is no longer guaranteed when `platformAutomerge` is `true` because the platform might automerge a branch which is not up-to-date.
For example, GitHub might automerge a Renovate branch even if it's behind the base branch at the time.

Please check platform specific docs for version requirements.

To learn how to use GitHub's Merge Queue feature with Renovate, read our [Key Concepts, Automerge, GitHub Merge Queue](./key-concepts/automerge.md#github-merge-queue) docs.

## platformCommit

Only use this option if you run Renovate as a [GitHub App](https://docs.github.com/en/developers/apps/getting-started-with-apps/about-apps).
It does not apply when you use a Personal Access Token as credential.

When `platformCommit` is enabled, Renovate will create commits with GitHub's API instead of using `git` directly.
This way Renovate can use GitHub's [Commit signing support for bots and other GitHub Apps](https://github.blog/2019-08-15-commit-signing-support-for-bots-and-other-github-apps/) feature.

## postUpdateOptions

Table with options:

| Name                         | Description                                                                                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bundlerConservative`        | Enable conservative mode for `bundler` (Ruby dependencies). This will only update the immediate dependency in the lockfile instead of all subdependencies. |
| `gomodMassage`               | Enable massaging `replace` directives before calling `go` commands.                                                                                        |
| `gomodTidy`                  | Run `go mod tidy` after Go module updates. This is implicitly enabled for major module updates when `gomodUpdateImportPaths` is enabled.                   |
| `gomodTidy1.17`              | Run `go mod tidy -compat=1.17` after Go module updates.                                                                                                    |
| `gomodTidyE`                 | Run `go mod tidy -e` after Go module updates.                                                                                                              |
| `gomodUpdateImportPaths`     | Update source import paths on major module updates, using [mod](https://github.com/marwan-at-work/mod).                                                    |
| `helmUpdateSubChartArchives` | Update subchart archives in the `/charts` folder.                                                                                                          |
| `npmDedupe`                  | Run `npm install` with `--prefer-dedupe` for npm >= 7 or `npm dedupe` after `package-lock.json` update for npm <= 6.                                       |
| `pnpmDedupe`                 | Run `pnpm dedupe --config.ignore-scripts=true` after `pnpm-lock.yaml` updates.                                                                             |
| `yarnDedupeFewer`            | Run `yarn-deduplicate --strategy fewer` after `yarn.lock` updates.                                                                                         |
| `yarnDedupeHighest`          | Run `yarn-deduplicate --strategy highest` (`yarn dedupe --strategy highest` for Yarn >=2.2.0) after `yarn.lock` updates.                                   |

## postUpgradeTasks

<!-- prettier-ignore -->
!!! note
    Post-upgrade tasks can only be used on self-hosted Renovate instances.

Post-upgrade tasks are commands that are executed by Renovate after a dependency has been updated but before the commit is created.
The intention is to run any other command line tools that would modify existing files or generate new files when a dependency changes.

Each command must match at least one of the patterns defined in `allowedPostUpgradeCommands` (a global-only configuration option) in order to be executed.
If the list of allowed tasks is empty then no tasks will be executed.

e.g.

```json
{
  "postUpgradeTasks": {
    "commands": ["tslint --fix"],
    "fileFilters": ["yarn.lock", "**/*.js"],
    "executionMode": "update"
  }
}
```

The `postUpgradeTasks` configuration consists of three fields:

### commands

A list of commands that are executed after Renovate has updated a dependency but before the commit is made.

You can use variable templating in your commands as long as [`allowPostUpgradeCommandTemplating`](./self-hosted-configuration.md#allowpostupgradecommandtemplating) is enabled.

<!-- prettier-ignore -->
!!! note
    Do not use `git add` in your commands to add new files to be tracked, add them by including them in your [`fileFilters`](#filefilters) instead.

### fileFilters

A list of glob-style matchers that determine which files will be included in the final commit made by Renovate.
Dotfiles are included.

Optional field which defaults to any non-ignored file in the repo (`**/*` glob pattern).
Specify a custom value for this if you wish to exclude certain files which are modified by your `postUpgradeTasks` and you don't want committed.

### executionMode

Defaults to `update`, but can also be set to `branch`.
This sets the level the postUpgradeTask runs on, if set to `update` the postUpgradeTask will be executed for every dependency on the branch.
If set to `branch` the postUpgradeTask is executed for the whole branch.

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

<!-- prettier-ignore -->
!!! note
    "Package file" is predefined in the default `prBodyDefinitions` object so does not require a definition before it can be used.

## prBodyDefinitions

You can configure this object to either (a) modify the template for an existing table column in PR bodies, or (b) you wish to _add_ a definition for a new/additional column.

Here is an example of modifying the default value for the `"Package"` column to put it inside a `<code></code>` block:

```json
{
  "prBodyDefinitions": {
    "Package": "`{{{depName}}}`"
  }
}
```

Here is an example of adding a custom `"Sourcegraph"` column definition:

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

<!-- prettier-ignore -->
!!! tip
    Columns must also be included in the `prBodyColumns` array in order to be used, so that's why it's included above in the example.

## prBodyNotes

Use this field to add custom content inside PR bodies, including conditionally.

e.g. if you wish to add an extra Warning to major updates:

```json
{
  "prBodyNotes": ["{{#if isMajor}}:warning: MAJOR MAJOR MAJOR :warning:{{/if}}"]
}
```

## prBodyTemplate

The available sections are:

- `header`
- `table`
- `warnings`
- `notes`
- `changelogs`
- `configDescription`
- `controls`
- `footer`

## prConcurrentLimit

This setting - if enabled - limits Renovate to a maximum of `x` concurrent PRs open at any time.

This limit is enforced on a per-repository basis.

<!-- prettier-ignore -->
!!! note
    Renovate always creates security PRs, even if the concurrent PR limit is already reached.
    Security PRs have `[SECURITY]` in their PR title.

## prCreation

This setting tells Renovate _when_ to create PRs:

- `immediate` (default): Renovate creates PRs immediately after creating the corresponding branch
- `not-pending`: Renovate waits until status checks have completed (passed or failed) before raising the PR
- `status-success`: Renovate only creates PRs if/when the the test pass
- `approval`: Renovate creates branches for updates immediately, but creates the PR _after_ getting Dependency Dashboard approval

When prCreation is set to `immediate`, you'll get a Pull Request and possible associated notification right away when a new update is available.
You'll have to wait until the checks have been performed, before you can decide if you want to merge the PR.

When prCreation is set to `not-pending`, Renovate creates the PR only once all tests have passed or failed.
When you get the PR notification, you can take action immediately, as you have the full test results.
If there are no checks associated, Renovate will create the PR once 24 hours have elapsed since creation of the commit.

When prCreation is set to `status-success`, Renovate creates the PR only if all tests have passed.
When a branch remains without PR due to a failing test: select the corresponding PR from the Dependency Dashboard, and push your fixes to the branch.

When prCreation is set to `approval`, Renovate creates the PR only when approved via the Dependency Dashboard.
Renovate still creates the _branch_ immediately.

<!-- prettier-ignore -->
!!! note
    For all cases of non-immediate PR creation, Renovate doesn't run instantly once tests complete.
    Instead, Renovate create the PR on its _next_ run after the relevant tests have completed, so there will be some delay.

<!-- prettier-ignore -->
!!! warning
    If you set `prCreation=approval` you must _not_ use `dependencyDashboardApproval=true`!

## prFooter

## prHeader

## prHourlyLimit

This config option slows down the _rate_ at which Renovate creates PRs.

Slowing Renovate down can be handy when you're onboarding a repository with a lot of dependencies.
What may happen if you don't set a `prHourlyLimit`:

1. Renovate creates an Onboarding PR
1. You merge the onboarding PR to activate Renovate
1. Renovate creates a "Pin Dependencies" PR (if needed)
1. You merge the "Pin Dependencies" PR
1. Renovate creates every single upgrade PR needed, which can be a lot

The above may cause:

- Renovate bot's PRs to overwhelm your CI systems
- a lot of test runs, because branches are rebased each time you merge a PR

To prevent these problems you can set `prHourlyLimit` to a value like `1` or `2`.
Renovate will only create that many PRs within each hourly period (`:00` through `:59`).
You still get all the PRs in a reasonable time, perhaps over a day or so.
Now you can merge the PRs at a do-able rate, once the tests pass.

<!-- prettier-ignore -->
!!! tip
    The `prHourlyLimit` setting does _not_ limit the number of _concurrently open PRs_, only the _rate_ at which PRs are created.
    The `prHourlyLimit` setting is enforced on a per-repository basis.

## prNotPendingHours

If you configure `prCreation=not-pending`, then Renovate will wait until tests are non-pending (all pass or at least one fails) before creating PRs.
However there are cases where PRs may remain in pending state forever, e.g. absence of tests or status checks that are configure to pending indefinitely.
This is why we configured an upper limit for how long we wait until creating a PR.

<!-- prettier-ignore -->
!!! note
    If the option `minimumReleaseAge` is non-zero then Renovate disables the `prNotPendingHours` functionality.

## prPriority

Sometimes Renovate needs to rate limit its creation of PRs, e.g. hourly or concurrent PR limits.
By default, Renovate sorts/prioritizes based on the update type, going from smallest update to biggest update.
Renovate creates update PRs in this order:

1. `pinDigest`
1. `pin`
1. `digest`
1. `patch`
1. `minor`
1. `major`

If you have dependencies that are more or less important than others then you can use the `prPriority` field for PR sorting.
The default value is 0, so setting a negative value will make dependencies sort last, while higher values sort first.

Here's an example of how you would define PR priority so that `devDependencies` are raised last and `react` is raised first:

```json
{
  "packageRules": [
    {
      "matchDepTypes": ["devDependencies"],
      "prPriority": -1
    },
    {
      "matchPackageNames": ["react"],
      "prPriority": 5
    }
  ]
}
```

## prTitle

The PR title is important for some of Renovate's matching algorithms (e.g. determining whether to recreate a PR or not) so ideally don't modify it much.

## prTitleStrict

There are certain scenarios where the default behavior appends extra context to the PR title.

These scenarios include if a `baseBranch` or if there is a grouped update and either `separateMajorMinor` or `separateMinorPatch` is true.

Using this option allows you to skip these default behaviors and use other templating methods to control the format of the PR title.

## printConfig

This option is useful for troubleshooting, particularly if using presets.
e.g. run `renovate foo/bar --print-config > config.log` and the fully-resolved config will be included in the log file.

## pruneBranchAfterAutomerge

By default Renovate deletes, or "prunes", the branch after automerging.
Set `pruneBranchAfterAutomerge` to `false` to keep the branch after automerging.

## pruneStaleBranches

Configure to `false` to disable deleting orphan branches and autoclosing PRs.
Defaults to `true`.

## rangeStrategy

Behavior:

- `auto` = Renovate decides (this will be done on a manager-by-manager basis)
- `pin` = convert ranges to exact versions, e.g. `^1.0.0` -> `1.1.0`
- `bump` = e.g. bump the range even if the new version satisfies the existing range, e.g. `^1.0.0` -> `^1.1.0`
- `replace` = Replace the range with a newer one if the new version falls outside it, and update nothing otherwise
- `widen` = Widen the range with newer one, e.g. `^1.0.0` -> `^1.0.0 || ^2.0.0`
- `update-lockfile` = Update the lock file when in-range updates are available, otherwise `replace` for updates out of range. Works for `bundler`, `composer`, `npm`, `yarn`, `terraform` and `poetry` so far
- `in-range-only` = Update the lock file when in-range updates are available, ignore package file updates

Renovate's `"auto"` strategy works like this for npm:

1. Widen `peerDependencies`
1. If an existing range already ends with an "or" operator like `"^1.0.0 || ^2.0.0"`, then Renovate widens it into `"^1.0.0 || ^2.0.0 || ^3.0.0"`
1. Otherwise, if the update is outside the existing range, Renovate replaces the range. So `"^2.0.0"` is replaced by `"^3.0.0"`
1. Finally, if the update is in-range, Renovate will update the lockfile with the new exact version.

By default, Renovate assumes that if you are using ranges then it's because you want them to be wide/open.
Renovate won't deliberately "narrow" any range by increasing the semver value inside.

For example, if your `package.json` specifies a value for `left-pad` of `^1.0.0` and the latest version on npmjs is `1.2.0`, then Renovate won't change anything because `1.2.0` satisfies the range.
If instead you'd prefer to be updated to `^1.2.0` in cases like this, then configure `rangeStrategy` to `bump` in your Renovate config.

This feature supports caret (`^`) and tilde (`~`) ranges only, like `^1.0.0` and `~1.0.0`.

The `in-range-only` strategy may be useful if you want to leave the package file unchanged and only do `update-lockfile` within the existing range.
The `in-range-only` strategy behaves like `update-lockfile`, but discards any updates where the new version of the dependency is not equal to the current version.
We recommend you avoid using the `in-range-only` strategy unless you strictly need it.
Using the `in-range-only` strategy may result in you being multiple releases behind without knowing it.

## rebaseLabel

On supported platforms it is possible to add a label to a PR to manually request Renovate to recreate/rebase it.
By default this label is `"rebase"` but you can configure it to anything you want by changing this `rebaseLabel` field.

## rebaseWhen

Possible values and meanings:

- `auto`: Renovate will autodetect the best setting. It will use `behind-base-branch` if configured to automerge or repository has been set to require PRs to be up to date. Otherwise, `conflicted` will be used instead
- `never`: Renovate will never rebase the branch or update it unless manually requested
- `conflicted`: Renovate will rebase only if the branch is conflicted
- `behind-base-branch`: Renovate will rebase whenever the branch falls 1 or more commit behind its base branch

`rebaseWhen=conflicted` is not recommended if you have enabled Renovate automerge, because:

- It could result in a broken base branch if two updates are merged one after another without testing the new versions together
- If you have enforced that PRs must be up-to-date before merging (e.g. using branch protection on GitHub), then automerge won't be possible as soon as a PR gets out-of-date but remains non-conflicted

It is also recommended to avoid `rebaseWhen=never` as it can result in conflicted branches with outdated PR descriptions and/or status checks.

Avoid setting `rebaseWhen=never` and then also setting `prCreation=not-pending` as this can prevent creation of PRs.

## recreateWhen

This feature used to be called `recreateClosed`.

By default, Renovate detects if it proposed an update to a project before, and will not propose the same update again.
For example the Webpack 3.x case described in the [`separateMajorMinor`](#separatemajorminor) documentation.
You can use `recreateWhen` to customize this behavior down to a per-package level.
For example we override it to `always` in the following cases where branch names and PR titles must be reused:

- Package groups
- When pinning versions
- Lock file maintenance

You can select which behavior you want from Renovate:

- `always`: Recreates all closed or blocking PRs
- `auto`: The default option. Recreates only immortal PRs (default)
- `never`: No PR is recreated, doesn't matter if it is immortal or not

We recommend that you stick with the default setting for this option.
Only change this setting if you really need to.

## registryAliases

You can use the `registryAliases` object to set registry aliases.

This feature works with the following managers:

- [`ansible`](modules/manager/ansible/index.md)
- [`bitbucket-pipelines`](modules/manager/bitbucket-pipelines/index.md)
- [`docker-compose`](modules/manager/docker-compose/index.md)
- [`dockerfile`](modules/manager/dockerfile/index.md)
- [`droneci`](modules/manager/droneci/index.md)
- [`gitlabci`](modules/manager/gitlabci/index.md)
- [`helm-requirements`](modules/manager/helm-requirements/index.md)
- [`helmfile`](modules/manager/helmfile/index.md)
- [`helmv3`](modules/manager/helmv3/index.md)
- [`kubernetes`](modules/manager/kubernetes/index.md)
- [`terraform`](modules/manager/terraform/index.md)
- [`woodpecker`](modules/manager/woodpecker/index.md)

```json
{
  "registryAliases": {
    "jfrogecosystem": "some.jfrog.mirror",
    "jfrog.com": "some.jfrog.mirror"
  }
}
```

## registryUrls

Usually Renovate is able to either (a) use the default registries for a datasource, or (b) automatically detect during the manager extract phase which custom registries are in use.
In case there is a need to configure them manually, it can be done using this `registryUrls` field, typically using `packageRules` like so:

```json
{
  "packageRules": [
    {
      "matchDatasources": ["docker"],
      "registryUrls": ["https://docker.mycompany.domain"]
    }
  ]
}
```

The field supports multiple URLs but it is datasource-dependent on whether only the first is used or multiple.

## replacement

Add to this object if you wish to define rules that apply only to PRs that replace dependencies.

## respectLatest

Similar to `ignoreUnstable`, this option controls whether to update to versions that are greater than the version tagged as `latest` in the repository.
By default, `renovate` will update to a version greater than `latest` only if the current version is itself past latest.

## reviewers

Must be valid usernames.

**Required reviewers on GitHub**

If you're assigning a team to review on GitHub, you must use the prefix `team:` and add the _last part_ of the team name.
Say the full team name on GitHub is `@organization/foo`, then you'd set the config option like this:

```json
{
  "reviewers": ["team:foo"]
}
```

**Required reviewers on Azure DevOps**

To mark a reviewer as required on Azure DevOps, you must use the prefix `required:`.

For example: if the username or team name is `bar` then you would set the config option like this:

```json
{
  "reviewers": ["required:bar"]
}
```

## reviewersFromCodeOwners

If enabled Renovate tries to determine PR reviewers by matching rules defined in a CODEOWNERS file against the changes in the PR.

See [GitHub](https://help.github.com/en/github/creating-cloning-and-archiving-repositories/about-code-owners) or [GitLab](https://docs.gitlab.com/ee/user/project/code_owners.html) documentation for details on syntax and possible file locations.

## reviewersSampleSize

## rollback

Add to this object if you wish to define rules that apply only to PRs that roll back versions.

## rollbackPrs

There are times when a dependency version in use by a project gets removed from the registry.
For some registries, existing releases or even whole packages can be removed or "yanked" at any time, while for some registries only very new or unused releases can be removed.
Renovate's "rollback" feature exists to propose a downgrade to the next-highest release if the current release is no longer found in the registry.

Renovate does not create these rollback PRs by default, so this functionality needs to be opted-into.
We recommend you do this selectively with `packageRules` and not globally.

## schedule

The `schedule` option allows you to define times of week or month for Renovate updates.
Running Renovate around the clock can be too "noisy" for some projects.
To reduce the noise you can use the `schedule` config option to limit the time frame in which Renovate will perform actions on your repository.
You can use the standard [Cron syntax](https://crontab.guru/crontab.5.html) and [Later syntax](https://github.com/breejs/later) to define your schedule.

The default value for `schedule` is "at any time", which is functionally the same as declaring a `null` schedule.
i.e. Renovate will run on the repository around the clock.

The easiest way to define a schedule is to use a preset if one of them fits your requirements.
See [Schedule presets](https://docs.renovatebot.com/presets-schedule/) for details and feel free to request a new one in the source repository if you think it would help others.

```title="Some text schedules that are known to work"
every weekend
before 5:00am
after 10pm and before 5:00am
after 10pm and before 5am every weekday
on friday and saturday
every 3 months on the first day of the month
* 0 2 * *
```

<!-- prettier-ignore -->
!!! warning
    For Cron schedules, you _must_ use the `*` wildcard for the minutes value, as Renovate doesn't support minute granularity.

One example might be that you don't want Renovate to run during your typical business hours, so that your build machines don't get clogged up testing `package.json` updates.
You could then configure a schedule like this at the repository level:

```json
{
  "schedule": ["after 10pm and before 5am every weekday", "every weekend"]
}
```

This would mean that Renovate can run for 7 hours each night plus all the time on weekends.

This scheduling feature can also be particularly useful for "noisy" packages that are updated frequently, such as `aws-sdk`.

To restrict `aws-sdk` to only monthly updates, you could add this package rule:

```json
{
  "packageRules": [
    {
      "matchPackageNames": ["aws-sdk"],
      "extends": ["schedule:monthly"]
    }
  ]
}
```

Technical details: We mostly rely on the text parsing of the library [@breejs/later](https://github.com/breejs/later) but only its concepts of "days", "time_before", and "time_after".
Read the parser documentation at [breejs.github.io/later/parsers.html#text](https://breejs.github.io/later/parsers.html#text).
To parse Cron syntax, Renovate uses [cron-parser](https://github.com/harrisiirak/cron-parser).
Renovate does not support scheduled minutes or "at an exact time" granularity.

<!-- prettier-ignore -->
!!! tip
    If you want to _disable_ Renovate, then avoid setting `schedule` to `"never"`.
    Instead, use the `enabled` config option to disable Renovate.
    Read the [`enabled` config option docs](#enabled) to learn more.

<!-- prettier-ignore -->
!!! note
    Actions triggered via the [Dependency Dashboard](#dependencydashboard) are not restricted by a configured schedule.

<!-- prettier-ignore -->
!!! tip
    To validate your `later` schedule before updating your `renovate.json`, you can use [this CodePen](https://codepen.io/rationaltiger24/full/ZExQEgK).

## semanticCommitScope

By default you will see Angular-style commit prefixes like `"chore(deps):"`.
If you wish to change it to something else like `"package"` then it will look like `"chore(package):"`.
You can also use `parentDir` or `baseDir` to namespace your commits for monorepos e.g. `"{{parentDir}}"`.

## semanticCommitType

By default you will see Angular-style commit prefixes like `"chore(deps):"`.
If you wish to change it to something else like "ci" then it will look like `"ci(deps):"`.

## semanticCommits

If you are using a semantic prefix for your commits, then you will want to enable this setting.
Although it's configurable to a package-level, it makes most sense to configure it at a repository level.
If configured to `enabled`, then the `semanticCommitScope` and `semanticCommitType` fields will be used for each commit message and PR title.

Renovate autodetects if your repository is already using semantic commits or not and follows suit, so you only need to configure this if you wish to _override_ Renovate's autodetected setting.

## separateMajorMinor

Renovate's default behavior is to create a separate branch/PR if both minor and major version updates exist (note that your choice of `rangeStrategy` value can influence which updates exist in the first place however).
For example, if you were using Webpack 2.0.0 and versions 2.1.0 and 3.0.0 were both available, then Renovate would create two PRs so that you have the choice whether to apply the minor update to 2.x or the major update of 3.x.
If you were to apply the minor update then Renovate would keep updating the 3.x branch for you as well, e.g. if Webpack 3.0.1 or 3.1.0 were released.
If instead you applied the 3.0.0 update then Renovate would clean up the unneeded 2.x branch for you on the next run.

It is recommended that you leave this option to `true`, because of the polite way that Renovate handles this.
For example, let's say in the above example that you decided you wouldn't update to Webpack 3 for a long time and don't want to build/test every time a new 3.x version arrives.
In that case, simply close the "Update Webpack to version 3.x" PR and it _won't_ be recreated again even if subsequent Webpack 3.x versions are released.
You can continue with Webpack 2.x for as long as you want and get any updates/patches that are made for it.
Then eventually when you do want to update to Webpack 3.x you can make that update to `package.json` yourself and commit it to the base branch once it's tested.
After that, Renovate will resume providing you updates to 3.x again!
i.e. if you close a major upgrade PR then it won't come back again, but once you make the major upgrade yourself then Renovate will resume providing you with minor or patch updates.

This option also has priority over package groups configured by `packageRule`.
So Renovate will propose separate PRs for major and minor updates of packages even if they are grouped.
If you want to enforce grouped package updates, you need to set this option to `false` within the `packageRule`.

## separateMinorPatch

By default, Renovate won't distinguish between "patch" (e.g. 1.0.x) and "minor" (e.g. 1.x.0) releases - it groups them together.
E.g., if you are running version 1.0.0 of a package and both versions 1.0.1 and 1.1.0 are available then Renovate will raise a single PR for version 1.1.0.
If you wish to distinguish between patch and minor upgrades, for example if you wish to automerge patch but not minor, then you can configured this option to `true`.

## separateMultipleMajor

Configure this to `true` if you wish to get one PR for every separate major version upgrade of a dependency.
e.g. if you are on webpack@v1 currently then default behavior is a PR for upgrading to webpack@v3 and not for webpack@v2.
If this setting is true then you would get one PR for webpack@v2 and one for webpack@v3.

## stopUpdatingLabel

This feature only works on supported platforms, check the table above.

If you want Renovate to stop updating a PR, you can apply a label to the PR.
By default, Renovate listens to the label: `"stop-updating"`.

You can set your own label name with the `"stopUpdatingLabel"` field:

```json
{
  "stopUpdatingLabel": "take-a-break-renovate"
}
```

## suppressNotifications

Use this field to suppress various types of warnings and other notifications from Renovate.
For example:

```json
{
  "suppressNotifications": ["prIgnoreNotification"]
}
```

The above config will suppress the comment which is added to a PR whenever you close a PR unmerged.

## timezone

It is only recommended to configure this field if you wish to use the `schedules` feature and want to write them in your local timezone.
Please see the above link for valid timezone names.

## transitiveRemediation

When enabled, Renovate tries to remediate vulnerabilities even if they exist only in transitive dependencies.

Applicable only for GitHub platform (with vulnerability alerts enabled) and `npm` manager.
When the `lockfileVersion` is higher than `1` in `package-lock.json`, remediations are only possible when changes are made to `package.json`.

This is considered a feature flag with the aim to remove it and default to this behavior once it has been more widely tested.

## updateInternalDeps

Renovate defaults to skipping any internal package dependencies within monorepos.
In such case dependency versions won't be updated by Renovate.

To opt in to letting Renovate update internal package versions normally, set this configuration option to true.

## updateLockFiles

## updateNotScheduled

When schedules are in use, it generally means "no updates".
However there are cases where updates might be desirable - e.g. if you have configured `prCreation=not-pending`, or you have `rebaseWhen=behind-base-branch` and the base branch is updated so you want Renovate PRs to be rebased.

This defaults to `true`, meaning that Renovate will perform certain "desirable" updates to _existing_ PRs even when outside of schedule.
If you wish to disable all updates outside of scheduled hours then configure this field to `false`.

## updatePinnedDependencies

By default, Renovate will try to update all detected dependencies, regardless of whether they are defined using pinned single versions (e.g. `1.2.3`) or constraints/ranges (e.g. (`^1.2.3`).
You can set this option to `false` if you wish to disable updating for pinned (single version) dependencies specifically.

## useBaseBranchConfig

By default, Renovate will read config file from the default branch only and will ignore any config files in base branches.
You can configure `useBaseBranchConfig=merge` to instruct Renovate to merge the config from each base branch over the top of the config in the default branch.

The config file name in the base branch must be the same as in the default branch and cannot be `package.json`.
This scenario may be useful for testing the config changes in base branches instantly.

## userStrings

When a PR is closed, Renovate posts a comment to let users know that future updates will be ignored.
If you want, you can change the text in the comment with the `userStrings` config option.

You can edit these user-facing strings:

- `ignoreDigest`: Text of the PR comment for digest upgrades.
- `ignoreMajor`: Text of the PR comment for major upgrades.
- `ignoreOther`: Text of the PR comment for other (neither digest nor major) upgrades.
- `ignoreTopic`: Topic of the PR comment.

For example:

```json
{
  "userStrings": {
    "ignoreTopic": "Custom topic for PR comment",
    "ignoreMajor": "Custom text for major upgrades.",
    "ignoreDigest": "Custom text for digest upgrades.",
    "ignoreOther": "Custom text for other upgrades."
  }
}
```

## versionCompatibility

This option is used for advanced use cases where the version string embeds more data than just the version.
It's typically used with docker and tags datasources.

Here are two examples:

- The image tag `ghcr.io/umami-software/umami:postgresql-v1.37.0` embeds text like `postgresql-` as a prefix to the actual version to differentiate different DB types.
- Docker image tags like `node:18.10.0-alpine` embed the base image as a suffix to the version.

Here is an example of solving these types of cases:

```json
{
  "packageRules": [
    {
      "matchDatasources": ["docker"],
      "matchPackageNames": ["ghcr.io/umami-software/umami"],
      "versionCompatibility": "^(?<compatibility>.*)-(?<version>.*)$",
      "versioning": "semver"
    },
    {
      "matchDatasources": ["docker"],
      "matchPackageNames": ["node"],
      "versionCompatibility": "^(?<version>[^-]+)(?<compatibility>-.*)?$",
      "versioning": "node"
    }
  ]
}
```

This feature is most useful when the `currentValue` is a version and not a range/constraint.

This feature _can_ be used in combination with `extractVersion` although that's likely only a rare edge case.
When combined, `extractVersion` is applied to datasource results first, and then `versionCompatibility`.
`extractVersion` should be used when the raw version string returned by the `datasource` contains extra details (such as a `v` prefix) when compared to the value/version used within the repository.

## versioning

Usually, each language or package manager has a specific type of "versioning":
JavaScript uses npm's SemVer implementation, Python uses pep440, etc.

Renovate also uses custom versioning, like `"docker"` to address the most common way people tag versions using Docker, and `"loose"` as a fallback that tries SemVer first.
Otherwise Renovate does its best to sort and compare.

By exposing `versioning` to config, you can override the default versioning for a package manager if needed.
We do not recommend overriding the default versioning, but there are some cases such as Docker or Gradle where versioning is not strictly defined and you may need to specify the versioning type per-package.

Renovate supports 4-part versions (1.2.3.4) in full for the NuGet package manager.
Other managers can use the `"loose"` versioning fallback: the first 3 parts are used as the version, all trailing parts are used for alphanumeric sorting.

## vulnerabilityAlerts

Renovate can read GitHub's Vulnerability Alerts to customize its Pull Requests.
For this to work, you must enable the [Dependency graph](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/about-the-dependency-graph#enabling-the-dependency-graph), and [Dependabot alerts](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-security-and-analysis-settings-for-your-repository).
Follow these steps:

1. While logged in to GitHub, navigate to your repository
1. Select the "Settings" tab
1. Select "Code security and analysis" in the sidebar
1. Enable the "Dependency graph"
1. Enable "Dependabot alerts"
1. If you're running Renovate in app mode: make sure the app has `read` permissions for "Dependabot alerts".
   If you're the account administrator, browse to the app (for example [the Mend Renovate App](https://github.com/apps/renovate)), select "Configure", and then scroll down to the "Permissions" section and make sure that `read` access to "Dependabot alerts" is mentioned

Once the above conditions are met, and you got one or more vulnerability alerts from GitHub for this repository, then Renovate tries to raise fix PRs.

You may use the `vulnerabilityAlerts` configuration object to customize vulnerability-fix PRs.

```json title="Setting a custom label and assignee"
{
  "vulnerabilityAlerts": {
    "labels": ["security"],
    "automerge": true,
    "assignees": ["@rarkins"]
  }
}
```

<!-- prettier-ignore -->
!!! warning
    There's a small chance that a wrong vulnerability alert results in a flapping/looping vulnerability fix.
    If you allow Renovate to `automerge` vulnerability fixes, please check if the automerged fix is correct.

<!-- prettier-ignore -->
!!! note
    When Renovate creates a `vulnerabilityAlerts` PR, it ignores settings like `prConcurrentLimit`, `branchConcurrentLimit`, `prHourlyLimit`, or `schedule`.
    This means that Renovate _always_ tries to create a `vulnerabilityAlerts` PR.
    In short: vulnerability alerts "skip the line".

To disable the vulnerability alerts feature, set `enabled=false` in a `vulnerabilityAlerts` config object, like this:

```json title="Disabling vulnerability alerts"
{
  "vulnerabilityAlerts": {
    "enabled": false
  }
}
```
