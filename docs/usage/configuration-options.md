---
title: Configuration Options
description: Configuration Options usable in renovate.json or package.json
---

# Configuration Options

This document describes all the configuration options you may configure in a Renovate configuration file.
Any config you define applies to the whole repository (e.g. if you have a monorepo).

You can store your Renovate configuration file in one of the following locations:

- `.github/renovate.json`
- `.github/renovate.json5`
- `.gitlab/renovate.json`
- `.gitlab/renovate.json5`
- `.renovaterc.json`
- `renovate.json`
- `renovate.json5`
- `.renovaterc`
- `package.json` _(within a `"renovate"` section)_

Renovate always uses the config from the repository's default branch, even if that configuration specifies multiple `baseBranches`.
Renovate does not read/override the config from within each base branch if present.

Also, be sure to check out Renovate's [shareable config presets](/config-presets/) to save yourself from reinventing any wheels.

If you have any questions about the config options, or want to get help/feedback about a config, go to the [discussions tab in the Renovate repository](https://github.com/renovatebot/renovate/discussions) and start a new "config help" discussion.
We will do our best to answer your question(s).

A `subtype` in the configuration table specifies what type you're allowed to use within the main element.

If a config option has a `parent` defined, it means it's only allowed to configure it within an object with the parent name, such as `packageRules` or `hostRules`.

When an array or object configuration option is `mergeable`, it means that values inside it will be added to any existing object or array that existed with the same name.

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

This value defaults to an empty string, and is typically not necessary.
Some managers previously populated this field, but they no longer do so by default.
You normally don't need to configure this, but one example where it can be useful is combining with `parentDir` in monorepos to split PRs based on where the package definition is located, e.g.

```json
{
  "additionalBranchPrefix": "{{parentDir}}-"
}
```

## additionalReviewers

In contrast to `reviewers`, this option adds to the existing reviewer list, rather than replacing it.
This makes it suitable for augmenting a preset or base list without displacing the original, for example when adding focused reviewers for a specific package group.

## aliases

The `aliases` object is used for configuring registry aliases.
Currently it is needed/supported for the `helm-requirements` manager only.

`helm-requirements` includes this default alias:

```json
{
  "aliases": {
    "stable": "https://charts.helm.sh/stable"
  }
}
```

Alias values must be properly formatted URIs.

## assignAutomerge

By default, Renovate will not assign reviewers and assignees to an automerge-enabled PR unless it fails status checks.
By configuring this setting to `true`, Renovate will instead always assign reviewers and assignees for automerging PRs at time of creation.

## assignees

Must be valid usernames on the platform in use.

## assigneesFromCodeOwners

If enabled Renovate will try to determine PR assignees by matching rules defined in a CODEOWNERS file against the changes in the PR.

See [GitHub](https://help.github.com/en/github/creating-cloning-and-archiving-repositories/about-code-owners) or [GitLab](https://docs.gitlab.com/ee/user/project/code_owners.html) documentation for details on syntax and possible file locations.

## assigneesSampleSize

If configured, Renovate will take a random sample of given size from assignees and assign them only, instead of assigning the entire list of `assignees` you have configured.

## automerge

By default, Renovate raises PRs but leaves them to someone or something else to merge them.
By configuring this setting, you can enable Renovate to automerge PRs or even branches itself, therefore reducing the amount of human intervention required.

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
So for example you could elect to automerge all (passing) `devDependencies` only this way:

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

Important: Renovate won't automerge on GitHub if a PR has a negative review outstanding.

Note: on Azure there can be a delay between a PR being set as completed by Renovate, and Azure merging the PR / finishing its tasks.
Renovate will try to delay until Azure is in the expected state, however if it takes too long it will continue.
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

## automergeType

This setting is only applicable if you opt in to configure `automerge` to `true` for any of your dependencies.

Automerging defaults to using Pull Requests (`automergeType="pr"`).
In that case Renovate first creates a branch and associated Pull Request, and then automerges the PR on a subsequent run once it detects the PR's status checks are "green".
If by the next run the PR is already behind master branch then it will be automatically rebased, because Renovate only automerges branches which are up-to-date and green.
If Renovate is scheduled for hourly runs on the repository but commits are made every 15 minutes to the main branch, then an automerge like this will keep getting deferred with every rebase.

Note: if you have no tests but still want Renovate to automerge, you need to add `"requiredStatusChecks": null` to your configuration.

If you prefer that Renovate more silently automerge _without_ Pull Requests at all, you can configure `"automergeType": "branch"`. In this case Renovate will:

- Create the branch, wait for test results
- Rebase it any time it gets out of date with the base branch
- Automerge the branch commit if it's: (a) up-to-date with the base branch, and (b) passing all tests
- As a backup, raise a PR only if either: (a) tests fail, or (b) tests remain pending for too long (default: 24 hours)

The final value for `automergeType` is `"pr-comment"`, intended only for users who already have a "merge bot" such as [bors-ng](https://github.com/bors-ng/bors-ng) and want Renovate to _not_ actually automerge by itself and instead tell `bors-ng` to merge for it, by using a comment in the PR.
If you're not already using `bors-ng` or similar, don't worry about this option.

## azureAutoComplete

Setting this to `true` will configure PRs in Azure DevOps to auto-complete after all (if any) branch policies have been met.

You can also configure this using `packageRules` if you want to use it selectively (e.g. per-package).

## azureWorkItemId

When creating a PR in Azure DevOps, some branches can be protected with branch policies to [check for linked work items](https://docs.microsoft.com/en-us/azure/devops/repos/git/branch-policies?view=azure-devops#check-for-linked-work-items).
Creating a work item in Azure DevOps is beyond the scope of Renovate, but Renovate can link an already existing work item when creating PRs.

## baseBranches

By default, Renovate will detect and process only the repository's default branch, e.g. `master`.
For most projects, this is the expected approach.
However, Renovate also allows users to explicitly configure `baseBranches`, e.g. for use cases such as:

- You wish Renovate to process only a non-default branch, e.g. `dev`: `"baseBranches": ["dev"]`
- You have multiple release streams you need Renovate to keep up to date, e.g. in branches `master` and `next`: `"baseBranches": ["master", "next"]`

It's possible to add this setting into the `renovate.json` file as part of the "Configure Renovate" onboarding PR.
If so then Renovate will reflect this setting in its description and use package file contents from the custom base branch(es) instead of default.

## bbUseDefaultReviewers

Configuring this to `true` means that Renovate will detect and apply the default reviewers rules to PRs (Bitbucket only).

## branchConcurrentLimit

By default, Renovate won't enforce any concurrent branch limits. If you want the same limit for both concurrent branches
and concurrent PRs, then just set a value for `prConcurrentLimit` and it will be reused for branch calculations too.
However, if you want to allow more concurrent branches than concurrent PRs, you can configure both values (
e.g. `branchConcurrentLimit=5` and `prConcurrentLimit=3`).

This limit is enforced on a per-repository basis.

Example config:

```json
{
  "branchConcurrentLimit": 3
}
```

## branchName

Warning: it's strongly recommended not to configure this field directly.
Use at your own risk.
If you truly need to configure this then it probably means either:

- You are hopefully mistaken, and there's a better approach you should use, so open a new "config help" discussion at the [Renovate discussions tab](https://github.com/renovatebot/renovate/discussions) or
- You have a use case we didn't anticipate and we should have a feature request from you to add it to the project

## branchPrefix

You can modify this field if you want to change the prefix used.
For example if you want branches to be like `deps/eslint-4.x` instead of `renovate/eslint-4.x` then you configure `branchPrefix` = `deps/`.
Or if you wish to avoid forward slashes in branch names then you could use `renovate_` instead, for example.

`branchPrefix` must be configured at the root of the configuration (e.g. not within any package rule) and is not allowed to use template values.
e.g. instead of `renovate/{{parentDir}}-`, configure the template part in `additionalBranchPrefix`, like `"additionalBranchPrefix": "{{parentDir}}-"`.

Note that this setting does not change the default _onboarding_ branch name, i.e. `renovate/configure`.
If you wish to change that too, you need to also configure the field `onboardingBranch` in your admin bot config.

## branchTopic

This field is combined with `branchPrefix` and `additionalBranchPrefix` to form the full `branchName`. `branchName` uniqueness is important for dependency update grouping or non-grouping so be cautious about ever editing this field manually.
This is an advance field and it's recommend you seek a config review before applying it.

## bumpVersion

Currently this setting supports `helmv3`, `npm` and `sbt` only, so raise a feature request if you have a use for it with other package managers.
Its purpose is if you want Renovate to update the `version` field within your file's `package.json` any time it updates dependencies within.
Usually this is for automatic release purposes, so that you don't need to add another step after Renovate before you can release a new version.

Configure this value to `"patch"`, `"minor"` or `"major"` to have Renovate update the version in your edited `package.json`.
e.g. if you wish Renovate to always increase the target `package.json` version with a patch update, configure this to `"patch"`.

For `npm` only you can also configure this field to `"mirror:x"` where `x` is the name of a package in the `package.json`.
Doing so means that the `package.json` `version` field will mirror whatever the version is that `x` depended on.
Make sure that version is a pinned version of course, as otherwise it won't be valid.

## cloneSubmodules

## commitBody

Configure this if you wish Renovate to add a commit body, otherwise Renovate just uses a regular single-line commit.

For example, To add `[skip ci]` to every commit you could configure:

```json
{
  "commitBody": "[skip ci]"
}
```

Another example would be if you want to configure a DCO signoff to each commit.

## commitBodyTable

## commitMessage

Editing of `commitMessage` directly is now deprecated and not recommended.
Please instead edit the fields such as `commitMessageAction`, `commitMessageExtra`, etc.

## commitMessageAction

This is used to alter `commitMessage` and `prTitle` without needing to copy/paste the whole string.
Actions may be like `Update`, `Pin`, `Roll back`, `Refresh`, etc.
Check out the default value for `commitMessage` to understand how this field is used.

## commitMessageExtra

This is used to alter `commitMessage` and `prTitle` without needing to copy/paste the whole string.
The "extra" is usually an identifier of the new version, e.g. "to v1.3.2" or "to tag 9.2".

## commitMessagePrefix

This is used to alter `commitMessage` and `prTitle` without needing to copy/paste the whole string.
The "prefix" is usually an automatically applied semantic commit prefix, however it can also be statically configured.

## commitMessageSuffix

This is used to add a suffix to commit messages.
Usually left empty except for internal use (multiple base branches, and vulnerability alerts).

## commitMessageTopic

This is used to alter `commitMessage` and `prTitle` without needing to copy/paste the whole string.
The "topic" is usually refers to the dependency being updated, e.g. `"dependency react"`.

## configWarningReuseIssue

Renovate's default behavior is to reuse/reopen a single Config Warning issue in each repository so as to keep the "noise" down.
However for some people this has the downside that the config warning won't be sorted near the top if you view issues by creation date.
Configure this option to `false` if you prefer Renovate to open a new issue whenever there is a config warning.

## constraints

Constraints are used in package managers which use third party tools to update "artifacts" like lock files or checksum files.
Typically, the constraint is detected automatically by Renovate from files within the repository and there is no need to manually configure it.

Constraints are also used to manually restrict which _datasource_ versions are possible to upgrade to based on their language support.
For now this only supports `python`, other compatibility restrictions will be added in the future.

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

Note: make sure not to mix this up with the term `compatibility`, which Renovate uses in the context of version releases, e.g. if a Docker image is `node:12.16.0-alpine` then the `-alpine` suffix represents `compatibility`.

## dependencyDashboard

Configuring `dependencyDashboard` to `true` will lead to the creation of a "Dependency Dashboard" issue within the repository.
This issue contains a list of all PRs pending, open, closed (unmerged) or in error.
The goal of this issue is to give visibility into all updates that Renovate is managing.

Examples of what having a Dependency Dashboard will allow you to do:

- View all PRs in one place, rather than having to filter PRs by author
- Rebase/retry multiple PRs without having to open each individually
- Override any rate limiting (e.g. concurrent PRs) or scheduling to force Renovate to create a PR that would otherwise be suppressed
- Recreate an unmerged PR (e.g. for a major update that you postponed by closing the original PR)

Note: Enabling the Dependency Dashboard does not itself change any of the "control flow" of Renovate, e.g. it will otherwise still create and manage PRs exactly as it always has, including scheduling and rate limiting.
The Dependency Dashboard therefore provides visibility as well as additional control.

## dependencyDashboardApproval

This feature allows you to use Renovate's Dependency Dashboard to force approval of updates before they are created.

By setting `dependencyDashboardApproval` to `true` in config (including within `packageRules`), you can tell Renovate to wait for your approval from the Dependency Dashboard before creating a branch/PR.
You can approve a pending PR by ticking the checkbox in the Dependency Dashboard issue.

Note: When you set `dependencyDashboardApproval` to `true` the Dependency Dashboard issue will be created automatically, you do not need to turn on `dependencyDashboard` explictly.

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

## dependencyDashboardTitle

Configure this option if you prefer a different title for the Dependency Dashboard.

## description

The description field is used by config presets to describe what they do.
They are then collated as part of the onboarding description.

## digest

Add to this object if you wish to define rules that apply only to PRs that update digests.

## docker

Add config here if you wish it to apply to Docker package managers Dockerfile and Docker Compose.
If instead you mean to apply settings to any package manager that updates using the Docker _datasource_, use a package rule instead, e.g.

```json
{
  "packageRules": [
    {
      "matchDatasources": ["docker"],
      "labels": ["docker-update"]
    }
  ]
}
```

## dotnet

## draftPR

If you want the PRs created by Renovate to be considered as drafts rather than normal PRs, you could add this property to your `renovate.json`:

```json
{
  "draftPR": true
}
```

This option is evaluated at PR/MR creation time and is only supported on the following platforms: GitHub, GitLab, Azure.

Note that GitLab implements draft status by checking whether the PR's title starts with certain strings.
Therefore, draftPR on GitLab is incompatible with the legacy method of triggering Renovate to rebase a PR by renaming the PR to start with `rebase!`.

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

For the full list of available managers, see the [Supported Managers](https://docs.renovatebot.com/modules/manager/#supported-managers) documentation.

## encrypted

See [Private npm module support](https://docs.renovatebot.com/private-modules) for details on how this is used to encrypt npm tokens.

## excludeCommitPaths

Warning: Advanced use!

Be careful you know what you're doing with this option.
The initial intended use is to allow the user to exclude certain dependencies from being added/removed/modified when "vendoring" dependencies.
Example:

```json
{
  "excludeCommitPaths": ["vendor/golang.org/x/text/**"]
}
```

The above would mean Renovate would not include files matching the above glob pattern in the commit, even if it thinks they should be updated.

## extends

See [shareable config presets](https://docs.renovatebot.com/config-presets) for details.

## extractVersion

Use this only when the raw version strings from the datasource do not match the expected format that you need in your package file.
You must defined a "named capture group" called `version` as shown in the below examples.

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

## fetchReleaseNotes

Configure this to `false` if you want to disable release notes fetching

## fileMatch

`fileMatch` is used by Renovate to know which files in a repository to parse and extract, and it is possible to override defaults values to customize for your project's needs.

Sometimes file matches are really simple - for example with Go Modules Renovate looks for any `go.mod` file, and you probably don't need to change that default.

At other times, the possible files is too vague for Renovate to have any default.
For default, Kubernetes manifests can exist in any `*.yaml` file and we don't want Renovate to parse every single YAML file in every repository just in case some of them contain a Kubernetes manifest, so Renovate's default `fileMatch` for manager `kubernetes` is actually empty (`[]`) and needs the user to tell Renovate what directories/files to look in.

Finally, there are cases where Renovate's default `fileMatch` is good, but you may be using file patterns that a bot couldn't possibly guess about.
For example, Renovate's default `fileMatch` for `Dockerfile` is `['(^|/|\\.)Dockerfile$', '(^|/)Dockerfile\\.[^/]*$']`.
This will catch files like `backend/Dockerfile`, `prefix.Dockerfile` or `Dockerfile.suffix`, but it will miss files like `ACTUALLY_A_DOCKERFILE.template`.
Because `fileMatch` is mergeable, you don't need to duplicate the defaults and could just add the missing file like this:

```json
{
  "dockerfile": {
    "fileMatch": ["^ACTUALLY_A_DOCKERFILE\\.template$"]
  }
}
```

If you configure `fileMatch` then it must be within a manager object (e.g. `dockerfile` in the above example).
The full list of supported managers can be found [here](https://docs.renovatebot.com/modules/manager/).

## followTag

Caution: advanced functionality. Only use it if you're sure you know what you're doing.

This functionality requires that the datasource to support distribution streams/tags, such as npm does.

The primary use case for this option is if you are following a pre-release tag of a certain dependency, e.g. `typescript`'s `"insiders"` build.
If configured, Renovate bypasses its normal major/minor/patch upgrade logic and stable/unstable consistency logic and keeps your dependency version sync'd strictly to whatever version is in the tag.

Beware that Renovate follows tags strictly.
For example, if you are following a tag like `next` and then that stream is released as `stable` and `next` is no longer being updated then that means your dependencies also won't be getting updated.

## gitIgnoredAuthors

Specify commit authors ignored by Renovate.

By default, Renovate will treat any PR as modified if another git author has added to the branch.
When a PR is considered modified, Renovate won't perform any further commits such as if it's conflicted or needs a version update.
If you have other bots which commit on top of Renovate PRs, and don't want Renovate to treat these PRs as modified, then add the other git author(s) to `gitIgnoredAuthors`.

Example:

```json
{
  "gitIgnoredAuthors": ["some-bot@example.org"]
}
```

## gitLabAutomerge

Caution (fixed in GitLab >= 12.7): when this option is enabled it is possible due to a bug in GitLab that MRs with failing pipelines might still get merged.
This is caused by a race condition in GitLab's Merge Request API - [read the corresponding issue](https://gitlab.com/gitlab-org/gitlab/issues/26293) for details.

## golang

Configuration added here applies for all Go-related updates, however currently the only supported package manager for Go is the native Go Modules (the `gomod` manager).

## group

Caution: Advanced functionality only. Do not use unless you know what you're doing.

The default configuration for groups are essentially internal to Renovate and you normally shouldn't need to modify them.
However, you may choose to _add_ settings to any group by defining your own `group` configuration object.

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

Note: you shouldn't usually need to configure this unless you really care about your branch names.

## hashedBranchLength

Some code hosting systems have restrictions on the branch name lengths, this option lets you get around these restrictions.
You can set the `hashedBranchLength` option to a number of characters that works for your system and then Renovate will generate branch names with the appropriate length by hashing `additionalBranchPrefix` and `branchTopic`, and then truncating the hash so that the full branch name (including `branchPrefix`) has the right number of characters.

Example: If you have set `branchPrefix: "deps-"` and `hashedBranchLength: 12` it will result in a branch name like `deps-5bf36ec` instead of the traditional pretty branch name like `deps-react-17.x`.

## hostRules

Currently the purpose of `hostRules` is to configure credentials for host authentication.
You tell Renovate how to match against the host you need authenticated, and then you also tell it which credentials to use.

The lookup keys for a hostRule are: `hostType`, `domainName`, `hostName`, and `baseUrl`.
All are optional, but you can only have one of the last three per rule.

Supported credential fields are `token`, `username`, `password`, `timeout`, `enabled` and `insecureRegistry`.

Example for configuring `docker` auth:

```json
{
  "hostRules": [
    {
      "domainName": "docker.io",
      "username": "<some-username>",
      "password": "<some-password>"
    }
  ]
}
```

To disable requests to a particular host, you can configure a rule like:

```json
{
  "hostRules": [
    {
      "hostName": "registry.npmjs.org",
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

Note: Disabling a host is only 100% effective if added to self-hosted config.
Renovate currently still checks its _cache_ for results first before making connection attempts, so if a public host is blocked in your repository config (e.g. `renovate.json`) then it's possible you may get cached _results_ from that host if another repository using the same bot has successfully queried for the same dependency recently.

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

Note that this field is _not_ mergeable, so the last-applied host rule will take precedence.

### abortOnError

Use this field to configure Renovate to abort runs for custom hosts.
By default, Renovate will only abort for known public hosts, which has the downside that transient errors for other hosts can cause autoclosing of PRs.

To abort Renovate runs for http failures from _any_ host:

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
      "hostName": "docker.company.com",
      "abortOnError": true
    }
  ]
}
```

When this field is enabled, Renovate will abort its run if it encounters either (a) any low-level http error (e.g. `ETIMEDOUT`) or (b) receives a response _not_ matching any of the configured `abortIgnoreStatusCodes` (e.g. `500 Internal Error`);

### authType

This can be used with `token` to create a custom http `authorization` header.

An example for npm basic auth with token:

```json
{
  "hostRules": [
    {
      "domainName": "npm.custom.org",
      "token": "<some-token>",
      "authType": "Basic"
    }
  ]
}
```

This will generate the following header: `authorization: Basic <some-token>`.

### baseUrl

Use this instead of `domainName` or `hostName` if you need a rule to apply to a specific path on a host.
For example, `"baseUrl": "https://api.github.com"` is equivalent to `"hostName": "api.github.com"` but `"baseUrl": "https://api.github.com/google/"` is not.

Renovate does not do a "longest match" algorithm to pick between multiple matching `baseUrl` values in different rules, so put the longer `baseUrl` rule _after_ the shorter one in your `hostRules`.

### concurrentRequestLimit

Usually the default setting is fine, but you can use `concurrentRequestLimit` to limit the number of concurrent outstanding requests.
You only need to adjust this setting if a datasource is rate limiting Renovate or has problems with the load.
The limit will be set for any host it applies to.

Example config:

```json
{
  "hostRules": [
    {
      "hostName": "github.com",
      "concurrentRequestLimit": 2
    }
  ]
}
```

### domainName

If you have any uncertainty about exactly which hosts a service uses, then it can be more reliable to use `domainName` instead of `hostName` or `baseUrl`.
e.g. configure `"hostName": "docker.io"` to cover both `index.docker.io` and `auth.docker.io` and any other host that's in use.

### enableHttp2

Enable got [http2](https://github.com/sindresorhus/got/blob/v11.5.2/readme.md#http2) support.

### hostName

### hostType

`hostType` is another way to filter rules and can be either a platform such as `github` and `bitbucket-server`, or it can be a datasource such as `docker` and `rubygems`.
You usually don't need to configure it in a host rule if you have already configured `domainName`, `hostName` or `baseUrl` and only one host type is in use for those, as is usually the case.
`hostType` can help for cases like an enterprise registry that serves multiple package types and has different authentication for each, although it's often the case that multiple `baseUrl` rules could achieve the same thing.

### insecureRegistry

Warning: Advanced config, use at own risk.

Enable this option to allow Renovate to connect to an [insecure Docker registry](https://docs.docker.com/registry/insecure/) that is http only.
This is insecure and is not recommended.

Example:

```json
{
  "hostRules": [
    {
      "hostName": "reg.insecure.com",
      "insecureRegistry": true
    }
  ]
}
```

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

## ignoreDeprecated

By default, Renovate won't update a dependency version to a deprecated release unless the current version was _itself_ deprecated.
The goal of this is to make sure you don't upgrade from a non-deprecated version to a deprecated one just because it's higher than the current version.

If for some reason you wish to _force_ deprecated updates with Renovate, you can configure `ignoreDeprecated` to `false`, but this is not recommended for most situations.

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

Using this setting, you can selectively ignore package files that you don't want Renovate autodiscovering.
For instance if your repository has an "examples" directory of many package.json files that you don't want to be kept up to date.

## ignorePrAuthor

This is usually needed if someone needs to migrate bot accounts, including from hosted app to self-hosted.
If `ignorePrAuthor` is configured to true, it means Renovate will fetch the entire list of repository PRs instead of optimizing to fetch only those PRs which it created itself.
You should only want to enable this if you are changing the bot account (e.g. from `@old-bot` to `@new-bot`) and want `@new-bot` to find and update any existing PRs created by `@old-bot`.
It's recommended to revert this setting once that transition period is over and all old PRs are resolved.

## ignorePresets

Use this if you are extending a complex preset but don't want to use every "sub preset" that it includes.
For example, consider this config:

```json
{
  "extends": ["config:base"],
  "ignorePresets": [":prHourlyLimit2"]
}
```

It would take the entire `"config:base"` preset - which contains a lot of sub-presets - but ignore the `":prHourlyLimit2"` rule.

## ignoreScripts

Applicable for npm and Composer only for now. Set this to `true` if running scripts causes problems.

## ignoreUnstable

By default, Renovate won't update any package versions to unstable versions (e.g. `4.0.0-rc3`) unless the current version has the same `major.minor.patch` and was _already_ unstable (e.g. it was already on `4.0.0-rc2`).
Renovate will also not "jump" unstable versions automatically, e.g. if you are on `4.0.0-rc2` and newer versions `4.0.0` and `4.1.0-alpha.1` exist then Renovate will update you to `4.0.0` only.
If you need to force permanent unstable updates for a package, you can add a package rule setting `ignoreUnstable` to `false`.

Also check out the `followTag` configuration option above if you wish Renovate to keep you pinned to a particular release tag.

## includeForks

By default, Renovate will skip over any repositories that are forked.
This includes if the forked repository contain a Renovate config file, because Renovate can't tell if that file was added by the original repository or not.
If you wish to enable processing of a forked repository by Renovate, you need to add `"includeForks": true` to your repository config or run the CLI command with `--include-forks=true`.

If you are using the hosted WhiteSource Renovate then this option will be configured to `true` automatically if you "Selected" repositories individually but remain as `false` if you installed for "All" repositories.

## includePaths

If you wish for Renovate to process only select paths in the repository, use `includePaths`.

Alternatively, if you need to just _exclude_ certain paths in the repository then consider `ignorePaths` instead.
If you are more interested in including only certain package managers (e.g. `npm`), then consider `enabledManagers` instead.

## java

Use this configuration option for shared config across all java projects (Gradle and Maven).

## js

Use this configuration option for shared config across npm/Yarn/pnpm and meteor package managers.

## labels

By default, Renovate won't add any labels to its PRs.
If you want Renovate to do so then define a `labels` array of one or more label strings.
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

## lockFileMaintenance

This feature can be used to refresh lock files and keep them up-to-date.
"Maintaining" a lock file means recreating it so that every dependency version within it is updated to the latest.
Supported lock files are `package-lock.json`, `yarn.lock`, `composer.lock`, `Gemfile.lock`, `poetry.lock` and `Cargo.lock`.
Others may be added via feature request.

This feature is disabled by default.
If you wish to enable this feature then you could add this to your configuration:

```json
{
  "lockFileMaintenance": { "enabled": true }
}
```

To reduce "noise" in the repository, it defaults its schedule to `"before 5am on monday"`, i.e. to achieve once-per-week semantics.
Depending on its running schedule, Renovate may run a few times within that time window - even possibly updating the lock file more than once - but it hopefully leaves enough time for tests to run and automerge to apply, if configured.

## major

Add to this object if you wish to define rules that apply only to major updates.

## minor

Add to this object if you wish to define rules that apply only to minor updates.

## node

Using this configuration option allows you to apply common configuration and policies across all Node.js version updates even if managed by different package managers (`npm`, `yarn`, etc.).

Check out our [Node.js documentation](https://docs.renovatebot.com/node) for a comprehensive explanation of how the `node` option can be used.

## npmToken

See [Private npm module support](https://docs.renovatebot.com/private-modules) for details on how this is used.
Typically you would encrypt it and put it inside the `encrypted` object.

## npmrc

See [Private npm module support](https://docs.renovatebot.com/private-modules) for details on how this is used.

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

Here is an example where you might want to limit the "noisy" package `aws-sdk` to updates just once per week:

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

For Maven dependencies, the package name is `<groupId:artefactId>`, eg `"matchPackageNames": ["com.thoughtworks.xstream:xstream"]`

Note how the above uses `matchPackageNames` instead of `matchPackagePatterns` because it is an exact match package name.
This is the equivalent of defining `"matchPackagePatterns": ["^aws\-sdk$"]` and hence much simpler.
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

Path rules are convenient to use if you wish to apply configuration rules to certain package files using patterns.
For example, if you have an `examples` directory and you want all updates to those examples to use the `chore` prefix instead of `fix`, then you could add this configuration:

```json
{
  "packageRules": [
    {
      "matchPaths": ["examples/**"],
      "extends": [":semanticCommitTypeAll(chore)"]
    }
  ]
}
```

If you wish to limit Renovate to apply configuration rules to certain files in the root repository directory, you have to use `matchPaths` with either a partial string match or a minimatch pattern.
For example you have multiple `package.json` and want to use `dependencyDashboardApproval` only on the root `package.json`:

```json
{
  "packageRules": [
    {
      "matchPaths": ["+(package.json)"],
      "dependencyDashboardApproval": true
    }
  ]
}
```

Important to know: Renovate will evaluate all `packageRules` and not stop once it gets a first match.
Therefore, you should order your `packageRules` in order of importance so that later rules can override settings from earlier rules if necessary.

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
For example, the following will enforce that only 3 or 4-section versions are supported, without any prefixes:

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

### matchLanguages

Use this field to restrict rules to a particular language. e.g.

```json
{
  "packageRules": [
    {
      "matchPackageNames": ["request"],
      "matchLanguages": ["python"],
      "enabled": false
    }
  ]
}
```

### matchBaseBranches

Use this field to restrict rules to a particular branch. e.g.

```json
{
  "packageRules": [
    {
      "matchBaseBranches": ["master"],
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

### matchCurrentVersion

`matchCurrentVersion` can be an exact semver version or a semver range.

This field also supports Regular Expressions which have to begin and end with `/`.
For example, the following will enforce that only `1.*` versions:

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

This field also supports a special negated regex syntax for ignoring certain versions.
Use the syntax `!/ /` like the following:

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

### matchFiles

Renovate will compare `matchFiles` for an exact match against the dependency's package file or lock file.

For example the following would match `package.json` but not `package/frontend/package.json`:

```
  "matchFiles": ["package.json"],
```

Use `matchPaths` instead if you need more flexible matching.

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

Just like the earlier `matchPackagePatterns` example, the above will configure `rangeStrategy` to `replace` for any package starting with `angular`.

### matchPaths

Renovate will match `matchPaths` against both a partial string match or a minimatch glob pattern.
If you want to avoid the partial string matching so that only glob matching is performed, wrap your string in `+(...)` like so:

```
  "matchPaths": ["+(package.json)"],
```

The above will match only the root `package.json`, whereas the following would match any `package.json` in any subdirectory too:

```
  "matchPaths": ["package.json"],
```

### matchSourceUrlPrefixes

Here's an example of where you use this to group together all packages from the Vue monorepo:

```json
{
  "packageRules": [
    {
      "matchSourceUrlPrefixes": ["https://github.com/vuejs/vue"],
      "groupName": "Vue monorepo packages"
    }
  ]
}
```

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

### matchUpdateTypes

Use this field to match rules against types of updates.
For example to apply a special label for Major updates:

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

## patch

Add to this object if you wish to define rules that apply only to patch updates.

## php

## pin

Add to this object if you wish to define rules that apply only to PRs that pin dependencies.

## pinDigests

If enabled Renovate will pin Docker images by means of their SHA256 digest and not only by tag so that they are immutable.

## postUpdateOptions

- `gomodTidy`: Run `go mod tidy` after Go module updates. This is implicitly enabled for major module updates.
- `gomodUpdateImportPaths`: Update source import paths on major module updates, using [mod](https://github.com/marwan-at-work/mod)
- `npmDedupe`: Run `npm dedupe` after `package-lock.json` updates
- `yarnDedupeFewer`: Run `yarn-deduplicate --strategy fewer` after `yarn.lock` updates
- `yarnDedupeHighest`: Run `yarn-deduplicate --strategy highest` (`yarn dedupe --strategy highest` for Yarn >=2.2.0) after `yarn.lock` updates

## postUpgradeTasks

Post-upgrade tasks are commands that are executed by Renovate after a dependency has been updated but before the commit is created.
The intention is to run any additional command line tools that would modify existing files or generate new files when a dependency changes.

Each command must match at least one of the patterns defined in `allowedPostUpgradeTasks` in order to be executed.
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

A list of commands that are executed after Renovate has updated a dependency but before the commit it made

### fileFilters

A list of glob-style matchers that determine which files will be included in the final commit made by Renovate

### executionMode

Defaults to `update`, but can also be set to `branch`. This sets the level the postUpgradeTask runs on, if set to `update` the postUpgradeTask
will be executed for every dependency on the branch. If set to `branch` the postUpgradeTask is executed for the whole branch.

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

Note: Columns must also be included in the `prBodyColumns` array in order to be used, so that's why it's included above in the example.

## prBodyNotes

Use this field to add custom content inside PR bodies, including conditionally.

e.g. if you wish to add an extra Warning to major updates:

```json
{
  "prBodyNotes": ["{{#if isMajor}}:warning: MAJOR MAJOR MAJOR :warning:{{/if}}"]
}
```

## prBodyTemplate

This setting controls which sections are rendered in the body of the pull request.

The available sections are header, table, notes, changelogs, configDescription, controls, footer.

## prConcurrentLimit

This setting - if enabled - limits Renovate to a maximum of x concurrent PRs open at any time.

Note that this limit is enforced on a per-repository basis.

## prCreation

This setting tells Renovate when you would like it to raise PRs:

- `immediate` (default): Renovate will create PRs immediately after creating the corresponding branch
- `not-pending`: Renovate will wait until status checks have completed (passed or failed) before raising the PR
- `status-success`: Renovate won't raise PRs unless tests pass

Renovate defaults to `immediate` but you might want to change this to `not-pending` instead.

With prCreation set to `immediate`, you'll get a Pull Request and possible associated notification right away when a new update is available.
Your test suite takes a bit of time to complete, so if you go look at the new PR right away, you don't know if your tests pass or fail.
You're basically waiting until you have the test results, before you can decide if you want to merge the PR or not.

With prCreation set to `not-pending`, Renovate waits until all tests have finished running, and only then creates the PR.
When you receive the PR notification, you can take action immediately, as you have the full test results.

When you set prCreation to `not-pending` you're reducing the "noise" but get notified of new PRs a bit later.

## prFooter

## prHeader

## prHourlyLimit

This setting - if enabled - helps slow down Renovate, particularly during the onboarding phase. What may happen without this setting is:

1. Onboarding PR is created
2. User merges onboarding PR to activate Renovate
3. Renovate creates a "Pin Dependencies" PR (if necessary)
4. User merges Pin PR
5. Renovate then creates every single upgrade PR necessary - potentially dozens

The above can result in swamping CI systems, as well as a lot of retesting if branches need to be rebased every time one is merged.
Instead, if `prHourlyLimit` is configure to a value like 1 or 2, it will mean that Renovate creates at most that many new PRs within each hourly period (:00-:59).
So the project should still result in all PRs created perhaps within the first 24 hours maximum, but at a rate that may allow users to merge them once they pass tests.
It does not place a limit on the number of _concurrently open_ PRs - only on the rate they are created.

Note that this limit is enforced on a per-repository basis.

## prNotPendingHours

If you configure `prCreation=not-pending`, then Renovate will wait until tests are non-pending (all pass or at least one fails) before creating PRs.
However there are cases where PRs may remain in pending state forever, e.g. absence of tests or status checks that are configure to pending indefinitely.
Therefore we configure an upper limit for how long we wait until creating a PR.

Note: if the option `stabilityDays` is non-zero then Renovate will disable the `prNotPendingHours` functionality.

## prPriority

Sometimes Renovate needs to rate limit its creation of PRs, e.g. hourly or concurrent PR limits.
In such cases it sorts/prioritizes by default based on the update type (e.g. patches raised before minor, minor before major).
If you have dependencies that are more or less important than others then you can use the `prPriority` field for PR sorting.
The default value is 0, so therefore setting a negative value will make dependencies sort last, while higher values sort first.

Here's an example of how you would define PR priority so that devDependencies are raised last and `react` is raised first:

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

## pruneStaleBranches

Configure to `false` to disable deleting orphan branches and autoclosing PRs.
Defaults to `true`.

## python

Currently the only Python package manager is `pip` - specifically for `requirements.txt` and `requirements.pip` files - so adding any config to this `python` object is essentially the same as adding it to the `pip_requirements` object instead.

## rangeStrategy

Behavior:

- `auto` = Renovate decides (this will be done on a manager-by-manager basis)
- `pin` = convert ranges to exact versions, e.g. `^1.0.0` -> `1.1.0`
- `bump` = e.g. bump the range even if the new version satisfies the existing range, e.g. `^1.0.0` -> `^1.1.0`
- `replace` = Replace the range with a newer one if the new version falls outside it, e.g. `^1.0.0` -> `^2.0.0`
- `widen` = Widen the range with newer one, e.g. `^1.0.0` -> `^1.0.0 || ^2.0.0`
- `update-lockfile` = Update the lock file when in-range updates are available, otherwise `replace` for updates out of range. Works for `bundler`, `composer`, `npm`, `yarn` and `poetry` so far

Renovate's `"auto"` strategy works like this for npm:

1. Always pin `devDependencies`
2. Pin `dependencies` if we detect that it's an app and not a library
3. Widen `peerDependencies`
4. If an existing range already ends with an "or" operator - e.g. `"^1.0.0 || ^2.0.0"` - then Renovate will widen it, e.g. making it into `"^1.0.0 || ^2.0.0 || ^3.0.0"`
5. Otherwise, replace the range. e.g. `"^2.0.0"` would be replaced by `"^3.0.0"`

By default, Renovate assumes that if you are using ranges then it's because you want them to be wide/open.
As such, Renovate won't deliberately "narrow" any range by increasing the semver value inside.

For example, if your `package.json` specifies a value for `left-pad` of `^1.0.0` and the latest version on npmjs is `1.2.0`, then Renovate won't change anything because `1.2.0` satisfies the range.
If instead you'd prefer to be updated to `^1.2.0` in cases like this, then configure `rangeStrategy` to `bump` in your Renovate config.

This feature supports simple caret (`^`) and tilde (`~`) ranges only, like `^1.0.0` and `~1.0.0`.

## rebaseLabel

On supported platforms it is possible to add a label to a PR to manually request Renovate to recreate/rebase it.
By default this label is `"rebase"` however you can configure it to anything you want by changing this `rebaseLabel` field.

## rebaseWhen

Possible values and meanings:

- `auto`: Renovate will autodetect the best setting. Defaults to `conflicted` unless the repository has a setting requiring PRs to be up to date with the base branch
- `never`: Renovate will never rebase the branch
- `conflicted`: Renovate will rebase only if the branch is conflicted
- `behind-base-branch`: Renovate will rebase whenever the branch falls 1 or more commit behind its base branch

`rebaseWhen=conflicted` is not recommended if you have enabled Renovate automerge, because:

- It could result in a broken base branch if two updates are merged one after another without testing the new versions together
- If you have enforced that PRs must be up-to-date before merging (e.g. using branch protection on GitHub), then automerge won't be possible as soon as a PR gets out-of-date but remains non-conflicted

## recreateClosed

By default, Renovate will detect if it has proposed an update to a project before and not propose the same one again.
For example the Webpack 3.x case described above.
This field lets you customise this behavior down to a per-package level.
For example we override it to `true` in the following cases where branch names and PR titles need to be reused:

- Package groups
- When pinning versions
- Lock file maintenance

Typically you shouldn't need to modify this setting.

## regexManagers

`regexManagers` entries are used to configure the `regex` Manager in Renovate.

Users can define custom managers for cases such as:

- Proprietary file formats or conventions
- Popular file formats not yet supported as a manager by Renovate

The custom manager concept is based on using Regular Expression named capture groups.
For the fields `datasource`, `depName` and `currentValue`, it's mandatory to have either a named capture group matching them (e.g. `(?<depName>.*)`) or to configure it's corresponding template (e.g. `depNameTemplate`).
It's not recommended to do both, due to the potential for confusion.
It is recommended to also include `versioning` however if it is missing then it will default to `semver`.

For more details and examples, see the documentation page the for the regex manager [here](/modules/manager/regex/).
For template fields, use the triple brace `{{{ }}}` notation to avoid Handlebars escaping any special characters.

### matchStrings

`matchStrings` should each be a valid regular expression, optionally with named capture groups.
Currently only a length of one `matchString` is supported.

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

As example the following configuration will update all 3 lines in the Dockerfile.
renovate.json:

```json
{
  "regexManagers": [
    {
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

a Dockerfile:

```dockerfile
FROM amd64/ubuntu:18.04
ENV GRADLE_VERSION=6.2 # gradle-version/gradle&versioning=maven
ENV NODE_VERSION=10.19.0 # github-tags/nodejs/node&versioning=node
```

#### recursive

If using `recursive` the `matchStrings` will be looped through and the full match of the last will define the range of the next one.
This can be used to narrow down the search area to prevent multiple matches.
However, the `recursive` strategy still allows the matching of multiple dependencies as described below.
All matches of the first `matchStrings` pattern are detected, then each of these matches will used as basis be used as the input for the next `matchStrings` pattern, and so on.
If the next `matchStrings` pattern has multiple matches then it will split again.
This process will be followed as long there is a match plus a next `matchingStrings` pattern is available or a dependency is detected.

This is an example how this can work.
The first regex manager will only upgrade `grafana/loki` as looks for the `backup` key then looks for the `test` key and then uses this result for extraction of necessary attributes.
However, the second regex manager will upgrade both definitions as its first `matchStrings` matches both `test` keys.

renovate.json:

```json
{
  "regexManagers": [
    {
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

example.json:

```json
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

This option allows the possibility to combine the values of multiple lines inside a file.
While using multiple lines is also possible using both other `matchStringStrategy` values, the `combination` approach is less susceptible to white space or line breaks stopping a match.

`combination` will only match at most one dependency per file, so if you want to update multiple dependencies using `combination` you have to define multiple regex managers.

Matched group values will be merged to form a single dependency.

renovate.json:

```json
{
  "regexManagers": [
    {
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

Ansible variable file ( yaml ):

```yaml
prometheus_image: "prom/prometheus"  // a comment
prometheus_version: "v2.21.0" // a comment
------
thanos_image: "prom/prometheus"  // a comment
thanos_version: "0.15.0" // a comment
```

In the above example, each regex manager will match a single dependency each.

### depNameTemplate

If `depName` cannot be captured with a named capture group in `matchString` then it can be defined manually using this field.
It will be compiled using Handlebars and the regex `groups` result.

### lookupNameTemplate

`lookupName` is used for looking up dependency versions.
It will be compiled using Handlebars and the regex `groups` result.
It will default to the value of `depName` if left unconfigured/undefined.

### datasourceTemplate

If the `datasource` for a dependency is not captured with a named group then it can be defined in config using this field.
It will be compiled using Handlebars and the regex `groups` result.

### versioningTemplate

If the `versioning` for a dependency is not captured with a named group then it can be defined in config using this field.
It will be compiled using Handlebars and the regex `groups` result.

### registryUrlTemplate

If the `registryUrls` for a dependency is not captured with a named group then it can be defined in config using this field.
It will be compiled using Handlebars and the regex `groups` result.

## registryUrls

Usually Renovate is able to either (a) use the default registries for a datasource, or (b) automatically detect during the manager extract phase which custom registries are in use.
In case there is a need to configure them manually, it can be done using this `registryUrls` field, typically using `packageUrls` like so:

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

The field supports multiple URLs however it is datasource-dependent on whether only the first is used or multiple.

## requiredStatusChecks

Currently Renovate's default behavior is to only automerge if every status check has succeeded.

Setting this option to `null` means that Renovate will ignore _all_ status checks.
You can set this if you don't have any status checks but still want Renovate to automerge PRs.
Beware: configuring Renovate to automerge without any tests can lead to broken builds on your default branch, please think again before enabling this!

In future, this might be configurable to allow certain status checks to be ignored/required.
See [issue 1853 at the Renovate repository](https://github.com/renovatebot/renovate/issues/1853) for more details.

## respectLatest

Similar to `ignoreUnstable`, this option controls whether to update to versions that are greater than the version tagged as `latest` in the repository.
By default, `renovate` will update to a version greater than `latest` only if the current version is itself past latest.

## reviewers

Must be valid usernames.
If on GitHub and assigning a team to review, use the prefix `team:`, e.g. provide a value like `team:someteam`.

## reviewersFromCodeOwners

If enabled Renovate will try to determine PR reviewers by matching rules defined in a CODEOWNERS file against the changes in the PR.

See [GitHub](https://help.github.com/en/github/creating-cloning-and-archiving-repositories/about-code-owners) or [GitLab](https://docs.gitlab.com/ee/user/project/code_owners.html) documentation for details on syntax and possible file locations.

## reviewersSampleSize

Take a random sample of given size from reviewers.

## rollback

Add to this object if you wish to define rules that apply only to PRs that roll back versions.

## rollbackPrs

There are times when a dependency version in use by a project gets removed from the registry.
For some registries, existing releases or even whole packages can be removed or "yanked" at any time, while for some registries only very new or unused releases can be removed.
Renovate's "rollback" feature exists to propose a downgrade to the next-highest release if the current release is no longer found in the registry.

Renovate does not create these rollback PRs by default, with one exception: npm packages get a rollback PR if needed.

You can configure the `rollbackPrs` property globally, per-lanuage, or per-package to override the default behavior.

## ruby

## rust

## schedule

The `schedule` option allows you to define times of week or month for Renovate updates.
Running Renovate around the clock may seem too "noisy" for some projects and therefore `schedule` is a good way to reduce the noise by reducing the timeframe in which Renovate will operate on your repository.

The default value for `schedule` is "at any time", which is functionally the same as declaring a `null` schedule.
i.e. Renovate will run on the repository around the clock.

The easiest way to define a schedule is to use a preset if one of them fits your requirements.
See [Schedule presets](https://docs.renovatebot.com/presets-schedule/) for details and feel free to request a new one in the source repository if you think others would benefit from it too.

Otherwise, here are some text schedules that are known to work:

```
every weekend
before 5:00am
after 10pm and before 5:00am
after 10pm and before 5am every weekday
on friday and saturday
every 3 months on the first day of the month
```

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

Technical details: We mostly rely on the text parsing of the library [later](https://bunkat.github.io/later/parsers.html#text) but only its concepts of "days", "time_before", and "time_after" (Renovate does not support scheduled minutes or "at an exact time" granularity).

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

However, please note that Renovate will autodetect if your repository is already using semantic commits or not and follow suit, so you only really need to configure this if you wish to _override_ Renovate's autodetected setting.

## separateMajorMinor

Renovate's default behavior is to create a separate branch/PR if both minor and major version updates exist (note that your choice of `rangeStrategy` value can influence which updates exist in the first place however).
For example, if you were using Webpack 2.0.0 and versions 2.1.0 and 3.0.0 were both available, then Renovate would create two PRs so that you have the choice whether to apply the minor update to 2.x or the major update of 3.x.
If you were to apply the minor update then Renovate would keep updating the 3.x branch for you as well, e.g. if Webpack 3.0.1 or 3.1.0 were released.
If instead you applied the 3.0.0 update then Renovate would clean up the unneeded 2.x branch for you on the next run.

It is recommended that you leave this setting to `true`, because of the polite way that Renovate handles this.
For example, let's say in the above example that you decided you wouldn't update to Webpack 3 for a long time and don't want to build/test every time a new 3.x version arrives.
In that case, simply close the "Update Webpack to version 3.x" PR and it _won't_ be recreated again even if subsequent Webpack 3.x versions are released.
You can continue with Webpack 2.x for as long as you want and receive any updates/patches that are made for it.
Then eventually when you do want to update to Webpack 3.x you can make that update to `package.json` yourself and commit it to master once it's tested.
After that, Renovate will resume providing you updates to 3.x again!
i.e. if you close a major upgrade PR then it won't come back again, but once you make the major upgrade yourself then Renovate will resume providing you with minor or patch updates.

## separateMinorPatch

By default, Renovate won't distinguish between "patch" (e.g. 1.0.x) and "minor" (e.g. 1.x.0) releases - it groups them together.
E.g., if you are running version 1.0.0 of a package and both versions 1.0.1 and 1.1.0 are available then Renovate will raise a single PR for version 1.1.0.
If you wish to distinguish between patch and minor upgrades, for example if you wish to automerge patch but not minor, then you can configured this option to `true`.

## separateMultipleMajor

Configure this to `true` if you wish to receive one PR for every separate major version upgrade of a dependency.
e.g. if you are on webpack@v1 currently then default behavior is a PR for upgrading to webpack@v3 and not for webpack@v2.
If this setting is true then you would get one PR for webpack@v2 and one for webpack@v3.

## stabilityDays

If this is configured to a non-zero value, and an update has a release date/timestamp available, then Renovate will check if the configured "stability days" have elapsed.
If the days since the release is less than the configured stability days then a "pending" status check will be added to the branch.
If enough days have passed then a passing status check will be added.

There are a couple of uses for this:

<!-- markdownlint-disable MD001 -->

#### Suppress branch/PR creation for X days

If you combine `stabilityDays=3` and `prCreation="not-pending"` then Renovate will hold back from creating branches until 3 or more days have elapsed since the version was released.
It's recommended that you enable `dependencyDashboard=true` so you don't lose visibility of these pending PRs.

#### Await X days before Automerging

If you have both `automerge` as well as `stabilityDays` enabled, it means that PRs will be created immediately but automerging will be delayed until X days have passed.
This works because Renovate will add a "renovate/stability-days" pending status check to each branch/PR and that pending check will prevent the branch going green to automerge.

<!-- markdownlint-enable MD001 -->

## supportPolicy

Language support is limited to those listed below:

- **Node.js** - [Read our Node.js documentation](https://docs.renovatebot.com/node#configuring-support-policy)

## suppressNotifications

Use this field to suppress various types of warnings and other notifications from Renovate.
Example:

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

When enabled, Renovate will attempt to remediate vulnerabilities even if they exist only in transitive dependencies.

Applicable only for GitHub platform (with vulnerability alerts enabled), `npm` manager, and when a `package-lock.json` v1 format is present.
This is considered a feature flag with the aim to remove it and default to this behavior once it has been more widely tested.

## unicodeEmoji

If enabled emoji shortcodes (`:warning:`) are replaced with their Unicode equivalents (`⚠️`).

## updateInternalDeps

Renovate defaults to skipping any internal package dependencies within monorepos.
In such case dependency versions won't be updated by Renovate.

To opt in to letting Renovate update internal package versions normally, set this configuration option to true.

## updateLockFiles

## updateNotScheduled

When schedules are in use, it generally means "no updates".
However there are cases where updates might be desirable - e.g. if you have configured prCreation=not-pending, or you have rebaseStale=true and master branch is updated so you want Renovate PRs to be rebased.

This defaults to `true`, meaning that Renovate will perform certain "desirable" updates to _existing_ PRs even when outside of schedule.
If you wish to disable all updates outside of scheduled hours then configure this field to `false`.

## versioning

Usually, each language or package manager has a specific type of "versioning". e.g. JavaScript uses npm's semver implementation, Python uses pep440, etc.
At Renovate we have also implemented some of our own, such as `"docker"` to address the most common way people tag versions using Docker, and `"loose"` as a fallback that tries semver first but otherwise just does its best to sort and compare.

By exposing `versioning` to config, it allows you to override the default versioning for a package manager if you really need.
In most cases it would not be recommended, but there are some cases such as Docker or Gradle where versioning is not strictly defined and you may need to specify the versioning type per-package.

## vulnerabilityAlerts

Renovate can read from GitHub's Vulnerability Alerts and customize Pull Requests accordingly.
For this to work, you must first ensure you have enabled "[Dependency graph](https://docs.github.com/en/code-security/supply-chain-security/about-the-dependency-graph#enabling-the-dependency-graph)" and "[Dependabot alerts](https://docs.github.com/en/github/administering-a-repository/managing-security-and-analysis-settings-for-your-repository)" under the "Security & analysis" section of the repository's "Settings" tab.

Additionally, if you are running Renovate in app mode then you must make sure that the app has been granted the permissions to read "Vulnerability alerts".
If you are the account admin, browse to the app (e.g. [https://github.com/apps/renovate](https://github.com/apps/renovate)), select "Configure", and then scroll down to the "Permissions" section and verify that read access to "vulnerability alerts" is mentioned.

Once the above conditions are met, and you have received one or more vulnerability alerts from GitHub for this repository, then Renovate will attempt to raise fix PRs accordingly.

Use the `vulnerabilityAlerts` configuration object if you want to customise vulnerability-fix PRs specifically.
For example, to configure custom labels and assignees:

```json
{
  "vulnerabilityAlerts": {
    "labels": ["security"],
    "assignees": ["@rarkins"]
  }
}
```

To disable the vulnerability alerts functionality completely, configure like this:

```json
{
  "vulnerabilityAlerts": {
    "enabled": false
  }
}
```

## yarnrc
