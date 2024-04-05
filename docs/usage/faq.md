---
title: Frequently Asked Questions (FAQ)
description: Frequently Asked Questions for Renovate Configuration
---

# Frequently Asked Questions (FAQ)

## What is the default behavior?

Renovate will:

- Look for configuration options in a configuration file (e.g. `renovate.json`) and in each `package.json` file
- Find and process all package files (e.g. `package.json`, `composer.json`, `Dockerfile`, etc) in each repository
- Use separate branches/PR for each dependency
- Use separate branches for each _major_ version of each dependency
- Pin devDependencies to a single version, rather than use ranges
- Pin dependencies to a single version if it appears not to be a library
- Update `yarn.lock` or `package-lock.json` files, if found
- Create Pull Requests immediately after branch creation

## Which Renovate versions are officially supported?

Only the latest version of Renovate is supported by the Renovate maintainers.
The Renovate team only fixes bugs in an older version if:

- the Mend Renovate App needs to stay on that older major version for a short time, or
- some critical bug needs to be fixed and the new major is blocked

If you're using the Mend Renovate App, you don't need to do anything, as the Renovate maintainers update it regularly.
If you're self hosting Renovate, use the latest release if possible.

## When is the Mend Renovate App updated with new Renovate versions?

The Renovate maintainers manually update the app.
The maintainers don't follow any release schedule or release cadence.
This means the Mend Renovate App can lag a few hours to a week behind the open source version.
Major releases of Renovate are held back until the maintainers are reasonably certain it works for most users.

## Renovate core features not supported on all platforms

| Feature               | Platforms which lack feature                               | See Renovate issue(s)                                        |
| --------------------- | ---------------------------------------------------------- | ------------------------------------------------------------ |
| Dependency Dashboard  | Azure, Bitbucket, Bitbucket Server                         | [#9592](https://github.com/renovatebot/renovate/issues/9592) |
| The Mend Renovate App | Azure, Bitbucket, Bitbucket Server, Forgejo, Gitea, GitLab |                                                              |

## Major platform features not supported by Renovate

Some major platform features are not supported at all by Renovate.

| Feature name                            | Platform                                  | See Renovate issue(s)                                                                                                                                                                        |
| --------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Jira issues                             | Bitbucket                                 | [#20568](https://github.com/renovatebot/renovate/issues/20568)                                                                                                                               |
| Jira issues                             | Bitbucket Server                          | [#3796](https://github.com/renovatebot/renovate/issues/3796)                                                                                                                                 |
| Merge trains                            | GitLab                                    | [#5573](https://github.com/renovatebot/renovate/issues/5573)                                                                                                                                 |
| Configurable merge strategy and message | Only Bitbucket, Forgejo and Gitea for now | [#10867](https://github.com/renovatebot/renovate/issues/10867) [#10869](https://github.com/renovatebot/renovate/issues/10869) [#10870](https://github.com/renovatebot/renovate/issues/10870) |

## What is this `main` branch I see in the documentation?

When you create a new repository with Git, Git creates a base branch for you.
The default branch name that Git uses is `master` (this will be changed to `main` later).

The Git-hosting ecosystem decided to use `main` instead of `master`.
When you create a new repository on say GitHub or GitLab, you'll get a `main` branch as your base branch.

We replaced `master` with `main` in our documentation where possible.

A branch name has no special meaning within the Git program, it's only a name.
The base branch could be called `trunk` or `mainline` or `prod`, and Git would work just as well.

## What if I need to .. ?

### Troubleshoot Renovate

If you have problems with Renovate, or want to know where Renovate keeps the logging output then read our [troubleshooting documentation](./troubleshooting.md).

### Tell Renovate to ask for approval before creating a Pull Request

By default, Renovate creates a pull request right away whenever there's an update.
But maybe you want Renovate to ask for your approval _before_ it creates a pull request.
Use the "Dependency Dashboard approval" workflow to get updates for certain packages - or certain types of updates - only after you give approval via the Dependency Dashboard.

The basic idea is that you create a new `packageRules` entry and describe what kind of package, or type of updates you want to approve beforehand.

```json title="Manually approve all major npm package manager updates"
{
  "packageRules": [
    {
      "matchUpdateTypes": ["major"],
      "matchManagers": ["npm"],
      "dependencyDashboardApproval": true
    }
  ]
}
```

```json title="Manually approve all major Jest updates"
{
  "packageRules": [
    {
      "matchPackagePatterns": ["^jest"],
      "matchUpdateTypes": ["major"],
      "dependencyDashboardApproval": true
    }
  ]
}
```

You may even configure Renovate bot to ask for approval for _all_ updates.
The `dependencyDashboardApproval` config option is outside of a `packageRules` array, and so applies to all updates:

```json
{
  "dependencyDashboardApproval": true
}
```

Read our documentation on the [dependencyDashboardApproval](./configuration-options.md#dependencydashboardapproval) config option.

### Use an alternative branch as my Pull Request target

Say your repository's default branch is `main` but you want Renovate to use the `next` branch as its PR target.
You can configure the PR target branch via the `baseBranches` option.

Add this line to the `renovate.json` file that's in the _default_ branch (`main` in this example).

```json
{
  "baseBranches": ["next"]
}
```

You can set more than one PR target branch in the `baseBranches` array.

### Support private npm modules

See the dedicated [Private npm module support](./getting-started/private-packages.md) page.

### Control Renovate's schedule

To learn about controlling Renovate schedule, read the [key concepts, scheduling](./key-concepts/scheduling.md) docs.

### Disable Renovate for certain dependency types

Define a `packageRules` entry which has the dependency type(s) in `matchDepTypes` and `"enabled": false`.

### Use a single branch/PR for all dependency upgrades

Add a configuration for configuration option `groupName` set to value `"all"`, at the top level of your `renovate.json` or `package.json`.

### Use separate branches per dependency, but not one per major release

Set configuration option `separateMajorMinor` to `false`.

### Keep using SemVer ranges, instead of pinning dependencies

Set configuration option `rangeStrategy` to `"replace"`.

### Keep lock files (including sub-dependencies) up-to-date, even when `package.json` hasn't changed

By default, if you enable lock-file maintenance, Renovate will update the lockfile `["before 4am on monday"]`.
If you want to update the lock file more often, set the `schedule` field inside the `lockFileMaintenance` object.

### Wait until tests have passed before creating the PR

Set the configuration option `prCreation` to `"status-success"`.
Branches with failing tests will remain in Git and get updated if needed.
Renovate will only create a PR once the tests pass.

### Wait until tests have passed before creating a PR, but create the PR even if they fail

Set the configuration option `prCreation` to `"not-pending"`.

### Assign PRs to specific user(s)

Set the configuration option `assignees` to an array of usernames.

### Add labels to PRs

Set the configuration option `labels` to an array of labels to use.

### Apply a rule, but only to package `abc`?

1. Add a `packageRules` array to your configuration
2. Create one object inside this array
3. Set field `matchPackageNames` to value `["abc"]`
4. Add the configuration option to the same object

e.g.

```json
{
  "packageRules": [
    {
      "matchPackageNames": ["abc"],
      "assignees": ["importantreviewer"]
    }
  ]
}
```

### Apply a rule, but only for packages starting with `abc`

Do the same as above, but instead of using `matchPackageNames`, use `matchPackagePatterns` and a regex:

```json
{
  "packageRules": [
    {
      "matchPackagePatterns": "^abc",
      "assignees": ["importantreviewer"]
    }
  ]
}
```

### Group all packages starting with `abc` together in one PR

As above, but apply a `groupName`:

```json
{
  "packageRules": [
    {
      "matchPackagePatterns": "^abc",
      "groupName": ["abc packages"]
    }
  ]
}
```

### Change the default values for branch name, commit message, PR title or PR description

You can use the `branchName`, `commitMessage`, `prTitle` or `prBody` configuration options to change the defaults for those settings.

### Automatically merge passing Pull Requests

Set the configuration option `automerge` to `true`.
Nest it inside a `patch` or `minor` object if you only want to automerge certain types of updates.

### Separate patch releases from minor releases

#### Renovate's default behavior for major/minor releases

By default, Renovate separates major and minor releases.
Patch releases are treated as "minor".
Here's an example:

Say you're using version `0.8.0` of the `foo` package.
The `foo` maintainers release the following versions:

- `0.8.1` (patch)
- `0.9.0` (minor)
- `1.0.0` (major)

Renovate creates the following PRs:

- Update dependency `foo` to `0.9.0` (minor)
- Update dependency `foo` to `1.0.0` (major)

Renovate groups the patch and minor versions into one PR.
This means you only get a PR for the minor version, `0.9.0`.

You can override this default behavior.
To learn more read the section below.

#### Overriding the default behavior for major/minor releases

You can see in the example above that Renovate won't normally create a PR for the `foo` patch release.

You can tell Renovate to create a separate PR for the patch release by setting `separateMinorPatch` to `true`.

In both cases, Renovate will open 3 PRs:

- Update dependency `foo` to `0.8.1` (patch)
- Update dependency `foo` to `0.9.0` (minor)
- Update dependency `foo` to `1.0.0` (major)

Usually you don't want more PRs though.
It can be nice to get patch PRs when you're using automerge:

- Get daily patch updates which are automerged once tests pass
- Get weekly updates for minor and major updates

This means you barely notice Renovate during the week, while you still get the benefits of patch level updates.
