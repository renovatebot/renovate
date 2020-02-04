---
title: Configuration Options
description: Configuration Options usable in renovate.json or package.json
---

# Configuration Options

This document describes all the configuration options you may configure in a Renovate configuration file. Any config you define applies to the whole repository (e.g. if you have a monorepo).

You can store your Renovate configuration file in one of the following locations:

- `.github/renovate.json`
- `.github/renovate.json5`
- `.renovaterc.json`
- `renovate.json`
- `renovate.json5`
- `.renovaterc`
- `package.json` _(within a `"renovate"` section)_

Also, be sure to check out Renovate's [shareable config presets](/config-presets/) to save yourself from reinventing any wheels.

If you have any questions about the below config options, or would like to get help/feedback about a config, please post it as an issue in [renovatebot/config-help](https://github.com/renovatebot/config-help) where we will do our best to answer your question.

## additionalReviewers

In contrast to `reviewers`, this option adds to the existing reviewer list, rather than replacing it. This makes it suitable for augmenting a preset or base list without displacing the original, for example when adding focused reviewers for a specific package group.

## aliases

The `aliases` object is used for configuring registry aliases. Currently it is needed/supported for the `helm-requiremenets` manager only.

`helm-requirements` includes this default alias:

```json
{
  "aliases": {
    "stable": "https://kubernetes-charts.storage.googleapis.com/"
  }
}
```

Alias values must be properly formatted URIs.

## ansible

Add configuration here if you want to enable or disable something in particular for Ansible files and override the default Docker settings.

## assignAutomerge

By default, Renovate will not assign reviewers and assignees to an automerge-enabled PR unless it fails status checks. By configuring this setting to `true`, Renvoate will instead always assign reviewers and assignees for automerging PRs at time of creation.

## assignees

Must be valid usernames on the platform in use.

## assigneesSampleSize

If configured, Renovate will take a random sample of given size from assignees and assign them only, instead of assigning the entire list of `assignees` you have configured.

## automerge

By default, Renovate raises PRs but leaves them to someone or something else to merge them. By configuring this setting, you can enable Renovate to automerge PRs or even branches itself, therefore reducing the amount of human intervention required.

Usually you won't want to automerge _all_ PRs, for example most people would want to leave major dependency updates to a human to review first. You could configure Renovate to automerge all but major this way:

```json
{
  "packageRules": [
    {
      "updateTypes": ["minor", "patch", "pin", "digest"],
      "automerge": true
    }
  ]
}
```

Also note that this option can be combined with other nested settings, such as dependency type. So for example you could elect to automerge all (passing) `devDependencies` only this way:

```json
{
  "packageRules": [
    {
      "depTypeList": ["devDependencies"],
      "automerge": true
    }
  ]
}
```

Important: Renovate won't automerge on GitHub if a PR has a negative review outstanding.

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

Automerging defaults to using Pull Requests (`automergeType="pr"`). In that case Renovate first creates a branch, then an associated Pull Request, and then automerges the first time it detects that the Pull Requests status checks are "green".

Note: if you have no tests but still want Renovate to automerge, you need to add `"requiredStatusChecks": null` to your configuration.

If you prefer that Renovate more silently automerge _without_ Pull Requests at all, you can configure `"automergeType": "branch"`. In this case Renovate will:

- Create the branch, wait for test results
- Rebase it any time it gets out of date with the base branch
- Automerge the branch commit if it's: (a) up-to-date with the base branch, and (b) passing all tests
- As a backup, raise a PR only if either: (a) tests fail, or (b) tests remain pending for too long (default: 24 hours)

The final value for `automergeType` is `"pr-comment"`, intended only for users who already have a "merge bot" such as [bors-ng](https://github.com/bors-ng/bors-ng) and want Renovate to _not_ actually automerge by itself and instead tell `bors-ng` to merge for it, by using a comment in the PR. If you're not already using `bors-ng` or similar, don't worry about this option.

## azureAutoComplete

Setting this to `true` will configure PRs in Azure DevOps to auto-complete after all (if any) branch policies have been met.

You can also configure this using `packageRules` if you want to use it selectively (e.g. per-package).

## azureWorkItemId

When creating a PR in Azure DevOps, some branches can be protected with branch policies to [check for linked work items](https://docs.microsoft.com/en-us/azure/devops/repos/git/branch-policies?view=azure-devops#check-for-linked-work-items). Creating a work item in Azure DevOps is beyond the scope of Renovate, but Renovate can link an already existing work item when creating PRs.

## baseBranches

By default, Renovate will detect and process only the repository's default branch, e.g. `master`. For most projects, this is the expected approach. However, Renovate also allows users to explicitly configure `baseBranches`, e.g. for use cases such as:

- You wish Renovate to process only a non-default branch, e.g. `dev`: `"baseBranches": ["dev"]`
- You have multiple release streams you need Renovate to keep up to date, e.g. in branches `master` and `next`: `"baseBranches": ["master", "next"]`

It's possible to add this setting into the `renovate.json` file as part of the "Configure Renovate" onboarding PR. If so then Renovate will reflect this setting in its description and use package file contents from the custom base branch(es) instead of default.

## bazel

Bazel is quite unlike most other "package managers" that Renovate supports, which usually focus on a particular ecosystem like JavaScript, Ruby or Docker. Instead, Bazel is a build tool so supports a multitude of languages/datasources. Renovate does not support all possible Bazel references, although would like to, and feature requests are welcoe.

## bbUseDefaultReviewers

Configuring this to `true` means that Renovate will detect and apply the default reviewers rules to PRs (Bitbucket only).

## branchName

Warning: it's strongly recommended not to configure this field directly. Use at your own risk. If you truly need to configure this then it probably means either:

- You are hopefully mistaken, and there's a better approach you should use, so [ask here](https://github.com/renovatebot/config-help) or
- You have a use case we didn't anticipate and we should have a feature request from you to add it to the project

## branchPrefix

You can modify this field if you want to change the prefix used. For example if you want branches to be like `deps/eslint-4.x` instead of `renovate/eslint-4.x` then you configure `branchPrefix` = `deps/`. Or if you wish to avoid forward slashes in branch names then you could use `renovate_` instead, for example.

Note that this setting does not change the default _onboarding_ branch name, i.e. `renovate/configure`. If you wish to change that too, you need to also configure the field `onboardingBranch` in your admin bot config.

## branchTopic

This field is combined with `branchPrefix` and `managerBranchPrefix` to form the full `branchName`. `branchName` uniqueness is important for dependency update grouping or non-grouping so be cautious about ever editing this field manually. This is an advance field and it's recommend you seek a config review before applying it.

## buildkite

## bumpVersion

Currently this setting supports `npm` only, so raise a feature request if you have a use for it with other package managers. It's purpose is if you want Renovate to update the `version` field within your file's `package.json` any time it updates depencies within. Usually this is for automatic release purposes, so that you don't need to add another step after Renovate before you can release a new version.

Configure this value to `"patch"`, `"minor"` or `"major"` to have Renovate update the version in your edited `package.json`. e.g. if you wish Renovate to always increase the target `package.json` version with a patch update, configure this to `"patch"`.

You can also configure this field to `"mirror:x"` where `x` is the name of a package in the `package.json`. Doing so means that the `package.json` `version` field will mirror whatever the version is that `x` depended on. Make sure that version is a pinned version of course, as otherwise it won't be valid.

## bundler

## cargo

## cdnurl

**Important**: This manager isn't aware of subresource integrity (SRI) hashes. It will search/replace any matching url it finds, without consideration for things such as script integrity hashes.

To enable this manager, add the matching files to `cdnurl.fileMatch`. For example:

```json
{
  "cdnurl": {
    "fileMatch": ["\\.html?$"]
  }
}
```

## circleci

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

Editing of `commitMessage` directly is now deprecated and not recommended. Please instead edit the fields such as `commitMessageAction`, `commitMessageExtra`, etc.

## commitMessageAction

This is used to alter `commitMessage` and `prTitle` without needing to copy/paste the whole string. Actions may be like `Update`, `Pin`, `Roll back`, `Refresh`, etc. Check out the default value for `commitMessage` to understand how this field is used.

## commitMessageExtra

This is used to alter `commitMessage` and `prTitle` without needing to copy/paste the whole string. The "extra" is usually an identifier of the new version, e.g. "to v1.3.2" or "to tag 9.2".

## commitMessagePrefix

This is used to alter `commitMessage` and `prTitle` without needing to copy/paste the whole string. The "prefix" is usually an automatically applied semantic commit prefix, however it can also be statically configured.

## commitMessageSuffix

This is used to add a suffix to commit messages. Usually left empty except for internal use (multiple base branches, and vulnerability alerts).

## commitMessageTopic

This is used to alter `commitMessage` and `prTitle` without needing to copy/paste the whole string. The "topic" is usually refers to the dependency being updated, e.g. `"dependency react"`.

## compatibility

This is used to manually restrict which versions are possible to upgrade to based on their language support. For now this only supports `python`, other compatibility restrictions will be added in the future.

```json
{
  "compatibility": {
    "python": "2.7"
  }
}
```

## composer

## configWarningReuseIssue

Renovate's default behaviour is to reuse/reopen a single Config Warning issue in each repository so as to keep the "noise" down. However for some people this has the downside that the config warning won't be sorted near the top if you view issues by creation date. Configure this option to `false` if you prefer Renovate to open a new issue whenever there is a config warning.

## deps-edn

## description

The description field is used by config presets to describe what they do. They are then collated as part of the onboarding description.

## digest

Add to this object if you wish to define rules that apply only to PRs that update Docker digests.

## docker

Add config here if you wish it to apply to Docker package managers Dockerfile and Docker Compose. If instead you mean to apply settings to any package manager that updates using the Docker _datasource_, use a package rule instead, e.g.

```json
{
  "packageRules": [
    {
      "datasources": ["docker"],
      "labels": ["docker-update"]
    }
  ]
}
```

## docker-compose

Add configuration here if you want to enable or disable something in particular for Docker Compose files and override the default Docker settings.

## dockerfile

Add configuration here if you want to enable or disable something in particular for `Dockerfile` files and override the default Docker settings.

## dotnet

## droneci

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
      "packagePatterns": ["^eslint"],
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
      "managers": ["npm"],
      "depTypeList": ["devDependencies"],
      "enabled": false
    }
  ]
}
```

## enabledManagers

This is a way to "whitelist" certain package managers and disable all others.

Possible managers are: `'ansible', 'bazel', 'buildkite', 'bundler', 'cargo', 'circleci', 'composer', 'deps-edn','docker-compose', 'dockerfile', 'droneci', 'github-actions', 'gitlabci', 'gitlabci-include', 'gomod', 'gradle', 'gradle-wrapper', 'homebrew', 'kubernetes', 'leiningen', 'maven', 'meteor', 'mix', 'npm', 'nuget', 'nvm', 'pip_requirements', 'pip_setup', 'pipenv', 'poetry', 'pub', 'sbt', 'swift', 'terraform', 'travis', 'ruby-version'`

Example:

```json
{
  "enabledManagers": ["dockerfile", "npm"]
}
```

## encrypted

See [Private npm module support](https://docs.renovatebot.com/private-modules) for details on how this is used to encrypt npm tokens.

## engines

Extend this if you wish to configure rules specifically for `engines` definitions. Renovate extracts and updates `node`, `npm` and `yarn` fields within.

## excludeCommitPaths

Warning: Advanced use!

Be careful you know what you're doing with this option. The initial intended use is to allow the user to exclude certain dependencies from being added/removed/modified when "vendoring" dependencies. Example:

```json
{
  "excludeCommitPaths": ["vendor/golang.org/x/text/**"]
}
```

The above would mean Renovate would not include files matching the above glob pattern in the commit, even if it thinks they should be updated.

## extends

See [shareable config presets](https://docs.renovatebot.com/config-presets) for details.

## fileMatch

`fileMatch` is used by Renovate to know which files in a repository to parse and extract, and it is possible to override defaults values to customize for your project's needs.

Sometimes file matches are really simple - for example with Go Modules Renovate looks for any `go.mod` file, and you probably don't need to change that default.

At other times, the possible files is too vague for Renovate to have any default. For default, Kubernetes manifests can exist in any `*.yaml` file and we don't want Renovate to parse every single YAML file in every repository just in case some of them contain a Kubernetes manifest, so Renovate's default `fileMatch` for manager `kubernetes` is actually empty (`[]`) and needs the user to tell Renovate what directories/files to look in.

Finally, there are cases where Renovate's default `fileMatch` is good, but you may be using file patterns that a bot couldn't posibly guess about. For example, Renovate's default `fileMatch` for `Dockerfile` is `['(^|/)Dockerfile$', '(^|/)Dockerfile\\.[^/]*$']`. This will catch files like `backend/Dockerfile` or `Dockerfile.base`, but it will miss files like `ACTUALLY_A_DOCKERFILE.template`. Because `fileMatch` is mergeable, you don't need to duplicate the defaults and could just add the missing file like this:

```json
{
  "dockerfile": {
    "fileMatch": ["^ACTUALLY_A_DOCKERFILE.template$"]
  }
}
```

## followTag

Caution: advanced functionality. Only use it if you're sure you know what you're doing.

This functionality requires that the datasource to support distribution streams/tags, such as npm does.

The primary use case for this option is if you are following a pre-release tag of a certain dependency, e.g. `typescript`'s `"insiders"` build. If configured, Renovate bypasses its normal major/minor/patch upgrade logic and stable/unstable consistency logic and keeps your dependency version sync'd strictly to whatever version is in the tag.

Beware that Renovate follows tags strictly. For example, if you are following a tag like `next` and then that stream is released as `stable` and `next` is no longer being updated then that means your dependencies also won't be getting updated.

## git-submodules

## gitLabAutomerge

Caution (fixed in GitLab >= 12.7): when this option is enabled it is possible due to a bug in GitLab that MRs with failing pipelines might still get merged. This is caused by a race condition in GitLab's Merge Request API - [read the corresponding issue](https://gitlab.com/gitlab-org/gitlab/issues/26293) for details.

## github-actions

**Important note**: For security reasons, GitHub has blocked integrations/apps from editing GitHub Actions workflow files in _any_ branch, so this only works on GitHub if using a Personal Access Token instead of using the WhiteSource Renovate app.

Add to this configuration setting if you need to override any of the GitHub Actions default settings.

## gitlabci

Add to this configuration setting if you need to override any of the GitLab CI default settings.

## gitlabci-include

Add to this configuration setting if you need to override any of the GitLab CI Includes default settings. Applies to the `include:` section only.

## golang

Configuration added here applies for all Go-related updates, however currently the only supported package manager for Go is the native Go Modules (the `gomod` manager).

## gomod

Configuration for Go Modules. Supersedes anything in the `golang` config object.

You might be interested to add `"postUpdateOptions": ["gomodTidy"]` to your config if you'd like Renovate to run `go mod tidy` after every update before raising the PR.

## gradle

Configuration for Java gradle projects.

## gradle-wrapper

Configuration for Gradle Wrapper updates. Changes here affect how Renovate updates the version of gradle in the wrapper, not how it uses the wrapper.

## group

Caution: Advanced functionality only. Do not use unless you know what you're doing.

The default configuration for groups are essentially internal to Renovate and you normally shouldn't need to modify them. However, you may choose to _add_ settings to any group by defining your own `group` configuration object.

## groupName

There are multiple cases where it can be useful to group multiple upgrades together. Internally Renovate uses this for branches such as "Pin Dependencies", "Lock File Maintenance", etc. Another example used previously is to group together all related `eslint` packages, or perhaps `angular` or `babel`. To enable grouping, you configure the `groupName` field to something non-null.

The `groupName` field allows free text and does not have any semantic interpretation by Renovate. All updates sharing the same `groupName` will be placed into the same branch/PR. For example, to group all non-major devDependencies updates together into a single PR:

```json
{
  "packageRules": [
    {
      "depTypeList": ["devDependencies"],
      "updateTypes": ["patch", "minor"],
      "groupName": "devDependencies (non-major)"
    }
  ]
}
```

## groupSlug

By default, Renovate will "slugify" the groupName to determine the branch name. For example if you named your group "devDependencies (non-major)" then the branchName would be `renovate/devdependencies-non-major`. If you wished to override this then you could configure like this:

```json
{
  "packageRules": [
    {
      "depTypeList": ["devDependencies"],
      "updateTypes": ["patch", "minor"],
      "groupName": "devDependencies (non-major)",
      "groupSlug": "dev-dependencies"
    }
  ]
}
```

As a result of the above, the branchName would be `renovate/dev-dependencies` instead.

Note: you shouldn't usually need to configure this unless you really care about your branch names.

## helm-requirements

Renovate supports updating Helm Chart references within `requirements.yaml` files. If your Helm charts make use of Aliases then you will need to configure an `aliases` object in your config to tell Renovate where to look for them.

## helm-values

Renovate supports updating of Docker dependencies within Helm Chart `values.yaml` files or other YAML
files that use the same format (via `fileMatch` configuration). Updates are performed if the files
follow the conventional format used in most of the `stable` Helm charts:

```yaml
image:
  repository: 'some-docker/dependency'
  tag: v1.0.0
  registry: registry.example.com # optional key, will default to "docker.io"
```

## helmfile

## homebrew

## hostRules

Currently the purpose of `hostRules` is to configure credentials for host authentication. You tell Renovate how to match against the host you need authenticated, and then you also tell it which credentials to use.

The lookup keys for a hostRule are: `hostType`, `domainName`, `hostName`, and `baseUrl`. All are optional, but you can only have one of the last three per rule.

Supported credential fields are `token`, `username`, `password`, `timeout` and `insecureRegistry`.

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

### baseUrl

Use this instead of `domainName` or `hostName` if you need a rule to apply to a specific path on a host. For example, `"baseUrl": "https://api.github.com"` is equivalent to `"hostName": "api.github.com"` but `"baseUrl": "https://api.github.com/google/"` is not.

Renovate does not do a "longest match" algorithm to pick between multiple matching `baseUrl` values in different rules, so put the longer `baseUrl` rule _after_ the shorter one in your `hostRules`.

### domainName

If you have any uncertainty about exactly which hosts a service uses, then it can be more reliable to use `domainName` instead of `hostName` or `baseUrl`. e.g. configure `"hostName": "docker.io"` to cover both `index.docker.io` and `auth.docker.io` and any other host that's in use.

### hostName

### hostType

`hostType` is another way to filter rules and can be either a platform such as `github` and `bitbucket-server`, or it can be a datasource such as `docker` and `rubygems`. You usually don't need to configure it in a host rule if you have already configured `domainName`, `hostName` or `baseUrl` and only one host type is in use for those, as is usually the case. `hostType` can help for cases like an enterprise registry that serves multiple package types and has different authentication for each, although it's often the case that multiple `baseUrl` rules could achieve the same thing.

### insecureRegistry

Warning: Advanced config, use at own risk.

Enable this option to allow Renovate to connect to an [insecure docker registry](https://docs.docker.com/registry/insecure/) that is http only. This is insecure and is not recommended.

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

Use this figure to adjust the timeout for queries. The default is 60s, which is quite high. To adjust it down to 10s for all queries, do this:

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

By default, Renovate won't update a dependency version to a deprecated release unless the current version was _itself_ deprecated. The goal of this is to make sure you don't upgrade from a non-deprecated version to a deprecated one just because it's higher than the current version.

If for some reason you wish to _force_ deprecated updates with Renovate, you can configure `ignoreDeprecated` to `false`, but this is not recommended for most situations.

## ignoreDeps

The `ignoreDeps` configuration field allows you to define a list of dependency names to be ignored by Renovate. Currently it supports only "exact match" dependency names and not any patterns. e.g. to ignore both `eslint` and `eslint-config-base` you would add this to your config:

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
      "packageNames": ["eslint", "eslint-config-base"],
      "enabled": false
    }
  ]
}
```

## ignoreNpmrcFile

By default, Renovate will look for and use any `.npmrc` file it finds in a repository. Additionally, it will be read in by `npm` or `yarn` at the time of lock file generation. Sometimes this causes problems, for example if the file contains placeholder values, so you can configure this to `true` and Renovate will ignore any `.npmrc` files it finds and temporarily remove the file before running `npm install` or `yarn install`. Renovate will try to configure this to `true` also if you have configured any `npmrc` string within your config file.

## ignorePaths

Using this setting, you can selectively ignore package files that you don't want Renovate autodiscovering. For instance if your repository has an "examples" directory of many package.json files that you don't want to be kept up to date.

## ignorePresets

Use this if you are extending a complex preset but don't want to use every "sub preset" that it includes. For example, consinder this config:

```json
{
  "extends": ["config:base"],
  "ignorePresets": [":prHourlyLimit2"]
}
```

It would take the entire `"config:base"` preset - which contains a lot of sub-presets - but ignore the `":prHourlyLimit2"` rule.

## ignoreScripts

Applicable for npm and composer only for now. Set this to `true` if running scripts causes problems.

## ignoreUnstable

By default, Renovate won't update any package versions to unstable versions (e.g. `4.0.0-rc3`) unless the current version has the same `major.minor.patch` and was _already_ unstable (e.g. it was already on `4.0.0-rc2`). Renovate will also not "jump" unstable versions automatically, e.g. if you are on `4.0.0-rc2` and newer versions `4.0.0` and `4.1.0-alpha.1` exist then Renovate will update you to `4.0.0` only. If you need to force permanent unstable updates for a package, you can add a package rule setting `ignoreUnstable` to `false`.

Also check out the `followTag` configuration option above if you wish Renovate to keep you pinned to a particular release tag.

## includeForks

By default, Renovate will skip over any repositories that are forked. This includes if the forked repository contain a Renovate config file, because Renovate can't tell if that file was added by the original repository or not. If you wish to enable processing of a forked repository by Renovate, you need to add `"includeForks": true` to your repository config or run the CLI command with `--include-forks=true`.

If you are using the hosted WhiteSource Renovate then this option will be configured to `true` automatically if you "Selected" repositories individually but remain as `false` if you installed for "All" repositories.

## includePaths

If you wish for Renovate to process only select paths in the repository, use `includePaths`.

Alternatively, if you need to just _exclude_ certain paths in the repository then consider `ignorePaths` instead.
If you are more interested in including only certain package managers (e.g. `npm`), then consider `enabledManagers` instead.

## java

Use this configuration option for shared config across all java projects (Gradle and Maven).

## js

Use this configuration option for shared config across npm/yarn/pnpm and meteor package managers.

## kubernetes

Add to this configuration object if you need to override any of the Kubernetes manager default settings. Use the `docker` config object instead if you wish for configuration to apply across all Docker-related package managers.

It's important to note that the `kubernetes` manager by default has no `fileMatch` defined - i.e. so it will never match any files unless you configure it. This is because there is no commonly accepted file/directory naming convention for Kubernetes YAML files and we don't want to download every single `*.yaml` file in repositories just in case any of them contain Kubernetes definitions.

If most `.yaml` files in your repository are Kubnernetes ones, then you could add this to your config:

```json
{
  "kubernetes": {
    "fileMatch": ["\\.yaml$"]
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
    "fileMatch": ["^config/k8s\\.yaml$"]
  }
}
```

## labels

By default, Renovate won't add any labels to its PRs. If you want Renovate to do so then define a `labels` array of one or more label strings. If you want the same label(s) for every PR then you can configure it at the top level of config. However you can also fully override them on a per-package basis.

Consider this example:

```json
{
  "labels": ["dependencies"],
  "packageRules": [
    {
      "packagePatterns": ["eslint"],
      "labels": ["linting"]
    }
  ]
}
```

With the above config, every PR raised by Renovate will have the label `dependencies` while PRs containing `eslint`-related packages will instead have the label `linting`.

## lazyGrouping

By default, Renovate will use group names in Pull Request titles only when the PR contains two or more dependencies. For example you may have defined a dependency group calls "All eslint packages" with a `packagePattern` of `^eslint`, but if the only upgrade available at the time is `eslint-config-airbnb` then it makes more sense for the PR to be named "Upgrade eslint-config-airbnb to v2.1.4" than to name it "Upgrade All eslint packages". If ever this behaviour is undesirable then you can override it by setting this option to `false`.

## leiningen

## lockFileMaintenance

This feature can be used to refresh lock files and keep them up-to-date. "Maintaining" a lock file means recreating it so that every dependency version within it is updated to the latest. Supported lock files are `package-lock.json`, `yarn.lock` and `composer.lock`. Others may be added via feature request.

This feature is disabled by default. If you wish to enable this feature then you could add this to your configuration:

```json
{
  "lockFileMaintenance": { "enabled": true }
}
```

To reduce "noise" in the repository, it defaults its schedule to `"before 5am on monday"`, i.e. to achieve once-per-week semantics. Depending on its running schedule, Renovate may run a few times within that time window - even possibly updating the lock file more than once - but it hopefully leaves enough time for tests to run and automerge to apply, if configured.

## major

Add to this object if you wish to define rules that apply only to major updates.

## managerBranchPrefix

This value defaults to an empty string, because historically no prefix was necessary for when Renovate was JS-only. Now - for example - we use `docker-` for Docker branches, so they may look like `renovate/docker-ubuntu-16.x`. You normally don't need to configure this.

## masterIssue

Configuring `masterIssue` to `true` will lead to the creation of a mini-dashboard "Master Issue" within the repository. This Master Issue contains a list of all PRs pending, open, closed (unmerged) or in error. The goal of this master issue is to give visibility into all updates that Renovate is managing.

Examples of what having a master issue will allow you to do:

- View all PRs in one place, rather than having to filter PRs by author
- Rebase/retry multiple PRs without having to open each individually
- Override any rate limiting (e.g. concurrent PRs) or scheduling to force Renovate to create a PR that would otherwise be suppressed
- Recreate an unmerged PR (e.g. for a major update that you postponed by closing the original PR)

Note: Enabling the Master Issue does not itself change any of the "control flow" of Renovate, e.g. it will otherwise still create and manage PRs exactly as it always has, including scheduling and rate limiting. The Master Issue therefore provides visibility as well as additional control.

## masterIssueApproval

Setting `masterIssueApproval` to `true` means that Renovate will no longer create branches/PRs automatically but instead wait for manual approval from within the Master Issue.

In this case, the Master Issue _does_ change the flow of Renovate, because PRs will stop appearing until you approve them within the issue. Instead of enabling this repository-wide, you may instead with to use package rules to enable it selectively, e.g. for major updates only, or for certain package managers, etc. i.e. it is possible to require approval for only certain types of updates only.

Note: Enabling Master Issue Approval implicitly enables `masterIssue` too, so it is not necessary to configure both to `true`.

## masterIssueAutoclose

You can configure this to `true` if you prefer Renovate to close an existing Master Issue whenever there are no outstanding PRs left.

## masterIssueTitle

Configure this option if you prefer a different title for the Master Issue.

## maven

## meteor

## minor

Add to this object if you wish to define rules that apply only to minor updates.

## mix

## node

Using this configuration option allows you to apply common configuration and policies across all Node.js version updates even if managed by different package managers (`npm`, `yarn`, etc.).

Check out our [Node.js documentation](https://docs.renovatebot.com/node) for a comprehensive explanation of how the `node` option can be used.

## npm

The following `depTypes` are currently supported by the npm manager :

- `dependencies`
- `devDependencies`
- `optionalDependencies`
- `peerDependencies`
- `engines` : Renovate will update any `node`, `npm` and `yarn` version specified under `engines`.
- `volta` : Renovate will update any `node` and `yarn` version specified under `volta`.

## npmToken

See [Private npm module support](https://docs.renovatebot.com/private-modules) for details on how this is used. Typically you would encrypt it and put it inside the `encrypted` object.

## npmrc

See [Private npm module support](https://docs.renovatebot.com/private-modules) for details on how this is used.

## nuget

The `nuget` configuration object is used to control settings for the NuGet package manager. The NuGet package manager supports SDK-style `.csproj`/`.fsproj`/`.vbproj` format, as described [here](https://natemcmaster.com/blog/2017/03/09/vs2015-to-vs2017-upgrade/). This means that .NET Core projects are all supported but any .NET Framework projects need to be updated to the new `.csproj`/`.fsproj`/`.vbproj` format in order to be detected and supported by Renovate.

## nvm

For settings common to all node.js version updates (e.g. travis, nvm, etc) you can use the `node` object instead of this.

## packageRules

`packageRules` is a powerful feature that lets you apply rules to individual packages or to groups of packages using regex pattern matching.

Here is an example if you want to group together all packages starting with `eslint` into a single branch/PR:

```json
{
  "packageRules": [
    {
      "packagePatterns": ["^eslint"],
      "groupName": "eslint packages"
    }
  ]
}
```

Note how the above uses `packagePatterns` with a regex value.

Here is an example where you might want to limit the "noisy" package `aws-sdk` to updates just once per week:

```json
{
  "packageRules": [
    {
      "packageNames": ["aws-sdk"],
      "schedule": ["after 9pm on sunday"]
    }
  ]
}
```

Note how the above uses `packageNames` instead of `packagePatterns` because it is an exact match package name. This is the equivalent of defining `"packagePatterns": ["^aws\-sdk$"]` and hence much simpler. However you can mix together both `packageNames` and `packagePatterns` in the same package rule and the rule will be applied if _either_ match. Example:

```json
{
  "packageRules": [
    {
      "packageNames": ["neutrino"],
      "packagePatterns": ["^@neutrino/"],
      "groupName": "neutrino monorepo"
    }
  ]
}
```

The above rule will group together the `neutrino` package and any package matching `@neutrino/*`.

Path rules are convenient to use if you wish to apply configuration rules to certain package files using patterns. For example, if you have an `examples` directory and you want all updates to those examples to use the `chore` prefix instead of `fix`, then you could add this configuration:

```json
{
  "packageRules": [
    {
      "paths": ["examples/**"],
      "extends": [":semanticCommitTypeAll(chore)"]
    }
  ]
}
```

Important to know: Renovate will evaluate all `packageRules` and not stop once it gets a first match. Therefore, you should order your `packageRules` in order of importance so that later rules can override settings from earlier rules if necessary.

### allowedVersions

Use this - usually within a packageRule - to limit how far to upgrade a dependency. For example, if you wish to upgrade to angular v1.5 but not to `angular` v1.6 or higher, you could define this to be `<= 1.5` or `< 1.6.0`:

```json
{
  "packageRules": [
    {
      "packageNames": ["angular"],
      "allowedVersions": "<=1.5"
    }
  ]
}
```

### depTypeList

Use this field if you want to limit a `packageRule` to certain `depType` values. Invalid if used outside of a `packageRule`.

### excludePackageNames

**Important**: Do not mix this up with the option `ignoreDeps`. Use `ignoreDeps` instead if all you want to do is have a list of package names for Renovate to ignore.

Use `excludePackageNames` if you want to have one or more exact name matches excluded in your package rule. See also `packageNames`.

```json
{
  "packageRules": [
    {
      "packagePatterns": ["^eslint"],
      "excludePackageNames": ["eslint-foo"]
    }
  ]
}
```

The above will match all package names starting with `eslint` but exclude the specific package `eslint-foo`.

### excludePackagePatterns

Use this field if you want to have one or more package name patterns excluded in your package rule. See also `packagePatterns`.

```json
{
  "packageRules": [
    {
      "packagePatterns": ["^eslint"],
      "excludePackagePatterns": ["^eslint-foo"]
    }
  ]
}
```

The above will match all package names starting with `eslint` but exclude ones starting with `eslint-foo`.

### languages

Use this field to restrict rules to a particular language. e.g.

```json
{
  "packageRules": [
    {
      "packageNames": ["request"],
      "languages": ["python"],
      "enabled": false
    }
  ]
}
```

### baseBranchList

Use this field to restrict rules to a particular branch. e.g.

```json
{
  "packageRules": [
    {
      "baseBranchList": ["master"],
      "excludePackagePatterns": ["^eslint"],
      "enabled": false
    }
  ]
}
```

### managers

Use this field to restrict rules to a particular package manager. e.g.

```json
{
  "packageRules": [
    {
      "packageNames": ["node"],
      "managers": ["dockerfile"],
      "enabled": false
    }
  ]
}
```

### datasources

Use this field to restrict rules to a particular datasource. e.g.

```json
{
  "packageRules": [
    {
      "datasources": ["orb"],
      "labels": ["circleci-orb!!"]
    }
  ]
}
```

### matchCurrentVersion

`matchCurrentVersion` can be an exact semver version or a semver range.

### packageNames

Use this field if you want to have one or more exact name matches in your package rule. See also `excludedPackageNames`.

```json
{
  "packageRules": [
    {
      "packageNames": ["angular"],
      "rangeStrategy": "pin"
    }
  ]
}
```

The above will configure `rangeStrategy` to `pin` only for the package `angular`.

### packagePatterns

Use this field if you want to have one or more package names patterns in your package rule. See also `excludePackagePatterns`.

```json
{
  "packageRules": [
    {
      "packagePatterns": ["^angular"],
      "rangeStrategy": "replace"
    }
  ]
}
```

The above will configure `rangeStrategy` to `replace` for any package starting with `angular`.

### paths

### sourceUrlPrefixes

Here's an example of where you use this to group together all packages from the Vue monorepo:

```json
{
  "packageRules": [
    {
      "sourceUrlPrefixes": ["https://github.com/vuejs/vue"],
      "groupName": "Vue monorepo packages"
    }
  ]
}
```

Here's an example of where you use this to group together all packages from the `renovatebot` github org:

```json
{
  "packageRules": [
    {
      "sourceUrlPrefixes": ["https://github.com/renovatebot/"],
      "groupName": "All renovate packages"
    }
  ]
}
```

### updateTypes

Use this field to match rules against types of updates. For example to apply a special label for Major updates:

```json
{
  "packageRules": [
    {
      "updateTypes": ["major"],
      "labels": ["UPDATE-MAJOR"]
    }
  ]
}
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

Warning: `setup.py` support is currently in beta, so is not enabled by default. You will need to configure `{ "pip_setup": { "enabled": true }}` to enable.

## pipenv

Add configuration here to change pipenv settings, e.g. to change the file pattern for pipenv so that you can use filenames other than Pipfile.

Warning: `pipenv` support is currently in beta, so it is not enabled by default. You will need to configure `{ "pipenv": { "enabled": true }}` to enable.

## poetry

## postUpdateOptions

- `gomodTidy`: Run `go mod tidy` after Go module updates
- `npmDedupe`: Run `npm dedupe` after `package-lock.json` updates
- `yarnDedupeFewer`: Run `yarn-deduplicate --strategy fewer` after `yarn.lock` updates
- `yarnDedupeHighest`: Run `yarn-deduplicate --strategy highest` after `yarn.lock` updates

## postUpgradeTasks

Post-upgrade tasks are commands that are executed by Renovate after a dependency has been updated but before the commit is created. The intention is to run any additional command line tools that would modify existing files or generate new files when a dependency changes.

This is only available on Renovate instances that have a `trustLevel` of 'high'. Each command must match at least one of the patterns defined in `allowedPostUpgradeTasks` in order to be executed. If the list of allowed tasks is empty then no tasks will be executed.

e.g.

```json
{
  "postUpgradeTasks": {
    "commands": ["tslint --fix"],
    "fileFilters": ["yarn.lock", "**/*.js"]
  }
}
```

The `postUpdateTasks` configuration consists of two fields:

### commands

A list of commands that are executed after Renovate has updated a dependency but before the commit it made

### fileFilters

A list of glob-style matchers that determine which files will be included in the final commit made by Renovate

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

## prConcurrentLimit

This setting - if enabled - limits Renovate to a maximum of x concurrent PRs open at any time.

Note that this limit is enforced on a per-repository basis.

## prCreation

This setting tells Renovate when you would like it to raise PRs:

- `immediate` (default): Renovate will create PRs immediately after creating the corresponding branch
- `not-pending`: Renovate will wait until status checks have completed (passed or failed) before raising the PR
- `status-success`: Renovate won't raise PRs unless tests pass

Renovate defaults to `immediate` but some like to change to `not-pending`. If you configure to immediate, it means you will usually get GitHub notifications that a new PR is available but if you view it immediately then it will still have "pending" tests so you can't take any action. With `not-pending`, it means that when you receive the PR notification, you can see if it passed or failed and take action immediately. Therefore you can customise this setting if you wish to be notified a little later in order to reduce "noise".

## prHourlyLimit

This setting - if enabled - helps slow down Renovate, particularly during the onboarding phase. What may happen without this setting is:

1.  Onboarding PR is created
2.  User merges onboarding PR to activate Renovate
3.  Renovate creates a "Pin Dependencies" PR (if necessary)
4.  User merges Pin PR
5.  Renovate then creates every single upgrade PR necessary - potentially dozens

The above can result in swamping CI systems, as well as a lot of retesting if branches need to be rebased every time one is merged. Instead, if `prHourlyLimit` is configure to a value like 1 or 2, it will mean that Renovate creates at most that many new PRs within each hourly period (:00-:59). So the project should still result in all PRs created perhaps within the first 24 hours maximum, but at a rate that may allow users to merge them once they pass tests. It does not place a limit on the number of _concurrently open_ PRs - only on the rate they are created.

Note that this limit is enforced on a per-repository basis.

## prNotPendingHours

If you configure `prCreation=not-pending`, then Renovate will wait until tests are non-pending (all pass or at least one fails) before creating PRs. However there are cases where PRs may remain in pending state forever, e.g. absence of tests or status checks that are configure to pending indefinitely. Therefore we configure an upper limit - default 24 hours - for how long we wait until creating a PR. Note also this is the same length of time as for Renovate's own `unpublishSafe` status check for npm.

## prPriority

Sometimes Renovate needs to rate limit its creation of PRs, e.g. hourly or concurrent PR limits. In such cases it sorts/prioritizes by default based on the update type (e.g. patches raised before minor, minor before major). If you have dependencies that are more or less important than others then you can use the `prPriority` field for PR sorting. The default value is 0, so therefore setting a negative value will make dependencies sort last, while higher values sort first.

Here's an example of how you would define PR priority so that devDependencies are raised last and `react` is raised first:

```json
{
  "packageRules": [
    {
      "depTypeList": ["devDependencies"],
      "prPriority": -1
    },
    {
      "packageNames": ["react"],
      "prPriority": 5
    }
  ]
}
```

## prTitle

The PR title is important for some of Renovate's matching algorithms (e.g. determining whether to recreate a PR or not) so ideally don't modify it much.

## pruneStaleBranches

Configure to `false` to disable deleting orphan branches and autoclosing PRs. Defaults to `true`.

## pub

## python

Currently the only Python package manager is `pip` - specifically for `requirements.txt` and `requirequirements.pip` files - so adding any config to this `python` object is essentially the same as adding it to the `pip_requirements` object instead.

## rangeStrategy

Behaviour:

- `auto` = Renovate decides (this will be done on a manager-by-manager basis)
- `pin` = convert ranges to exact versions, e.g. `^1.0.0` -> `1.1.0`
- `bump` = e.g. bump the range even if the new version satisifies the existing range, e.g. `^1.0.0` -> `^1.1.0`
- `replace` = Replace the range with a newer one if the new version falls outside it, e.g. `^1.0.0` -> `^2.0.0`
- `widen` = Widen the range with newer one, e.g. `^1.0.0` -> `^1.0.0 || ^2.0.0`
- `update-lockfile` = Update the lock file when in-range updates are available, otherwise `replace` for updates out of range. Works only for `npm` and `yarn` so far.

Renovate's `"auto"` strategy works like this for npm:

1.  Always pin `devDependencies`
2.  Pin `dependencies` if we detect that it's an app and not a library
3.  Widen `peerDependencies`
4.  If an existing range already ends with an "or" operator - e.g. `"^1.0.0 || ^2.0.0"` - then Renovate will widen it, e.g. making it into `"^1.0.0 || ^2.0.0 || ^3.0.0"`.
5.  Otherwise, replace the range. e.g. `"^2.0.0"` would be replaced by `"^3.0.0"`

**bump**

By default, Renovate assumes that if you are using ranges then it's because you want them to be wide/open. As such, Renovate won't deliberately "narrow" any range by increasing the semver value inside.

For example, if your `package.json` specifies a value for `left-pad` of `^1.0.0` and the latest version on npmjs is `1.2.0`, then Renovate won't change anything because `1.2.0` satisfies the range. If instead you'd prefer to be updated to `^1.2.0` in cases like this, then configure `rangeStrategy` to `bump` in your Renovate config.

This feature supports simple caret (`^`) and tilde (`~`) ranges only, like `^1.0.0` and `~1.0.0`.

## rebaseConflictedPrs

This field defaults to `true` which means Renovate will rebase whenever there is a merge conflict with the master branch. However, this default behavior may result in costing a lot of CI cycles. If you wish to disable auto-rebasing in case of merge conflicts with the master branch, configure it's value to `false`.

## rebaseLabel

On GitHub it is possible to add a label to a PR to manually request Renovate to recreate/rebase it. By default this label is `"rebase"` however you can configure it to anything you want by changing this `rebaseLabel` field.

## rebaseStalePrs

This field defaults to `null` because it has the potential to create a lot of noise and additional builds to your repository. If you enable it to `true`, it means each Renovate branch will be updated whenever the base branch has changed. If enabled, this also means that whenever a Renovate PR is merged (whether by automerge or manually via GitHub web) then any other existing Renovate PRs will then need to get rebased and retested.

If you configure it to `false` then that will take precedence - it means Renovate will ignore if you have configured the repository for "Require branches to be up to date before merging" in Branch Protection. However if you have configured it to `false` _and_ configured `branch` automerge then Renovate will still rebase as necessary for that.

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

Must be valid usernames. If on GitHub and assigning a team to review, use the prefix `team:`, e.g. provide a value like `team:someteam`.

## reviewersSampleSize

Take a random sample of given size from reviewers.

## rollbackPrs

Configure this to `false` either globally, per-language, or per-package if you want to disable Renovate's behaviour of generating rollback PRs when it can't find the current version on the registry anymore.

## ruby

## ruby-version

## rust

## sbt

It isn't supporting Scala version inference well (`%%` operator), just searching for package like `<artifactId>_<scalaVersion>` without any additional resolving.
In case of problems, please use explicit versions with `%` operator.

## schedule

The `schedule` option allows you to define times of week or month for Renovate updates. Running Renovate around the clock may seem too "noisy" for some projects and therefore `schedule` is a good way to reduce the noise by reducing the timeframe in which Renovate will operate on your repository.

The default value for `schedule` is "at any time", which is functionally the same as declaring a `null` schedule. i.e. Renovate will run on the repository around the clock.

The easiest way to define a schedule is to use a preset if one of them fits your requirements. See [Schedule presets](https://docs.renovatebot.com/presets-schedule/) for details and feel free to request a new one in the source repository if you think others would benefit from it too.

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
{
  "schedule": ["after 10pm and before 5am on every weekday", "every weekend"]
}
```

This would mean that Renovate can run for 7 hours each night plus all the time on weekends.

This scheduling feature can also be particularly useful for "noisy" packages that are updated frequently, such as `aws-sdk`.

To restrict `aws-sdk` to only monthly updates, you could add this package rule:

```json
{
  "packageRules": [
    {
      "packageNames": ["aws-sdk"],
      "extends": ["schedule:monthly"]
    }
  ]
}
```

Technical details: We mostly rely on the text parsing of the library [later](https://bunkat.github.io/later/parsers.html#text) but only its concepts of "days", "time_before", and "time_after" (Renovate does not support scheduled minutes or "at an exact time" granularity).

## semanticCommitScope

By default you will see angular-style commit prefixes like `"chore(deps):"`. If you wish to change it to something else like `"package"` then it will look like `"chore(package):"`. You can also use `parentDir` or `baseDir` to namespace your commits for monorepos e.g. `"{{parentDir}}"`.

## semanticCommitType

By default you will see angular-style commit prefixes like `"chore(deps):"`. If you wish to change it to something else like "ci" then it will look like `"ci(deps):"`.

## semanticCommits

If you are using a semantic prefix for your commits, then you will want to enable this setting. Although it's configurable to a package-level, it makes most sense to configure it at a repository level. If configured to `true`, then the `semanticPrefix` field will be used for each commit message and PR title.

However, please note that Renovate will autodetect if your repository is already using semantic commits or not and follow suit, so you only really need to configure this if you wish to _override_ Renovate's autodetected setting.

## separateMajorMinor

Renovate's default behaviour is to create a separate branch/PR if both minor and major version updates exist. For example, if you were using Webpack 2.0.0 and versions 2.1.0 and 3.0.0 were both available, then Renovate would create two PRs so that you have the choice whether to apply the minor update to 2.x or the major update of 3.x. If you were to apply the minor update then Renovate would keep updating the 3.x branch for you as well, e.g. if Webpack 3.0.1 or 3.1.0 were released. If instead you applied the 3.0.0 update then Renovate would clean up the unneeded 2.x branch for you on the next run.

It is recommended that you leave this setting to `true`, because of the polite way that Renovate handles this. For example, let's say in the above example that you decided you wouldn't update to Webpack 3 for a long time and don't want to build/test every time a new 3.x version arrives. In that case, simply close the "Update Webpack to version 3.x" PR and it _won't_ be recreated again even if subsequent Webpack 3.x versions are released. You can continue with Webpack 2.x for as long as you want and receive any updates/patches that are made for it. Then eventually when you do want to update to Webpack 3.x you can make that update to `package.json` yourself and commit it to master once it's tested. After that, Renovate will resume providing you updates to 3.x again! i.e. if you close a major upgrade PR then it won't come back again, but once you make the major upgrade yourself then Renovate will resume providing you with minor or patch updates.

## separateMinorPatch

By default, Renovate won't distinguish between "patch" (e.g. 1.0.x) and "minor" (e.g. 1.x.0) releases - it groups them together. E.g., if you are running version 1.0.0 of a package and both versions 1.0.1 and 1.1.0 are available then Renovate will raise a single PR for version 1.1.0. If you wish to distinguish between patch and minor upgrades, for example if you wish to automerge patch but not minor, then you can configured this option to `true`.

## separateMultipleMajor

Configure this to `true` if you wish to receive one PR for every separate major version upgrade of a dependency. e.g. if you are on webpack@v1 currently then default behaviour is a PR for upgrading to webpack@v3 and not for webpack@v2. If this setting is true then you would get one PR for webpack@v2 and one for webpack@v3.

## stabilityDays

If this is configured to a non-zero value, and an update has a release date/timestamp available, then Renovate will check if the configured "stability days" have elapsed. If the days since the release is less than the configured stability days then a "pending" status check will be added to the branch. If enough days have passed then a passing status check will be added.

There are a couple of uses for this:

#### Suppress branch/PR creation for X days

If you combine `stabilityDays=3` and `prCreation="not-pending"` then Renovate will hold back from creating branches until 3 or more days have elapsed since the version was released. It's recommended that you enable `masterIssue=true` so you don't lose visibility of these pending PRs.

#### Await X days before Automerging

If you have both `automerge` as well as `stabilityDays` enabled, it means that PRs will be created immediately but automerging will be delayed until X days have passed. This works because Renovate will add a "renovate/stability-days" pending status check to each branch/PR and that pending check will prevent the branch going green to automerge.

## statusCheckVerify

This feature is added for people migrating from alternative services who are used to seeing a "verify" status check on PRs. If you'd like to use this then go ahead, but otherwise it's more secure to look for Renovate's [GPG Verified Commits](https://github.com/blog/2144-gpg-signature-verification) instead, because those cannot be spoofed by any other person or service (unlike status checks).

## supportPolicy

Language support is limited to those listed below:

- **Node.js** - [Read our Node.js documentation](https://docs.renovatebot.com/node#configuring-support-policy)

## suppressNotifications

Use this field to suppress various types of warnings and other notifications from Renovate. Example:

```json
{
  "suppressNotifications": ["prIgnoreNotification"]
}
```

The above config will suppress the comment which is added to a PR whenever you close a PR unmerged.

## swift

Anything other than `.exact(<...>)` will be treated as range with respect to Swift specific.
Because of this, some PR descriptions will look like `from: <...> => <...>`.

Examples:

```swift
package(name: "<...>", from: "1.2.3")     // => from: "2.0.0"
package(name: "<...>", "1.2.3"...)        // => "2.0.0"...
package(name: "<...>", "1.2.3"..."1.3.0") // => "1.2.3"..."2.0.0"
package(name: "<...>", "1.2.3"..<"1.3.0") // => "1.2.3"..<"2.0.0"
package(name: "<...>", ..."1.2.3")        // => ..."2.0.0"
package(name: "<...>", ..<"1.2.3")        // => ..<"2.0.0"
```

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

It is only recommended to configure this field if you wish to use the `schedules` feature and want to write them in your local timezone. Please see the above link for valid timezone names.

## travis

For settings common to all node.js version updates (e.g. travis, nvm, etc) you can use the `node` object instead.

Note: Travis renovation is disabled by default as we cannot be sure of which combination of releases you want until you configure supportPolicy.

## unicodeEmoji

If enabled emoji shortcodes (`:warning:`) are replaced with their unicode equivalents (`⚠️`)

## unpublishSafe

It is not known by many that npm package authors and collaborators can _delete_ an npm version if it is less than 24 hours old. e.g. version 1.0.0 might exist, then version 1.1.0 is released, and then version 1.1.0 might get deleted hours later. This means that version 1.1.0 essentially "disappears" and 1.0.0 returns to being the "latest". If you have installed 1.1.0 during that time then your build is essentially broken.

Enabling `unpublishSafe` will add a `renovate/unpublish-safe` status check with value pending to every branch to warn you about this possibility. It can be handy when used with the `prCreation` = `not-pending` configuration option - that way you won't get the PR raised until after a patch is 24 hours old or more.

## updateLockFiles

## updateNotScheduled

When schedules are in use, it generally means "no updates". However there are cases where updates might be desirable - e.g. if you have configured prCreation=not-pending, or you have rebaseStale=true and master branch is updated so you want Renovate PRs to be rebased.

This defaults to `true`, meaning that Renovate will perform certain "desirable" updates to _existing_ PRs even when outside of schedule. If you wish to disable all updates outside of scheduled hours then configure this field to `false`.

## versionScheme

Usually, each language or package manager has a specific type of "version scheme". e.g. JavaScript uses npm's semver implementation, Python uses pep440, etc. At Renovate we have also implemented some of our own, such as `"docker"` to address the most common way people tag versions using Docker, and `"loose"` as a fallback that tries semver first but otherwise just does its best to sort and compare.

By exposing `versionScheme` to config, it allows you to override the default version scheme for a package manager if you really need. In most cases it would not be recommended, but there are some cases such as Docker or Gradle where versioning is not strictly defined and you may need to specify the versioning type per-package.

For the `regex` `versionScheme`, will accept a regex string after a colon, for example:

```json
{
  "versionScheme": "regex:^(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)(?<prerelease>[^.-]+)?(-(?<compatibility>.*))?$"
}
```

The valid capture groups for the `regex` `versionScheme` are:

- `major`, `minor`, and `patch`: at least one of these must be provided. When determining whether a package has updated, these values will be compared in the standard semantic versioning fashion. If any of these fields are omitted, they will be treated as if they were `0` -- in this way, you can describe versioning schemes with up to three incrementing values.
- `prerelease`: this value, if captured, will mark a given release as a prerelease (eg. unstable). If this value is captured and you have configured `"ignoreUnstable": true`, the given release will be skipped.
- `compatibility`: this value defines the "build compatibility" of a given dependency. A proposed Renovate update will never change the specified compatibility value. For example, if you are pinning to `1.2.3-linux` (and `linux` is captured as the compatbility value), Renovate will not update you to `1.2.4-osx`.

## vulnerabilityAlerts

Use this object to customise PRs that are raised when vulnerability alerts are detected (GitHub-only). For example, to configure custom labels and assignees:

```json
{
  "vulnerabilityAlerts": {
    "labels": ["security"],
    "assignees": ["@rarkins"]
  }
}
```

To disable vulnerability alerts completely, configure like this:

```json
{
  "vulnerabilityAlerts": {
    "enabled": false
  }
}
```

## yarnrc
