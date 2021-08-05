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
- Update `yarn.lock` and/or `package-lock.json` files if found
- Create Pull Requests immediately after branch creation

## What is this `main` branch I see in the documentation?

When you create a new repository with Git, Git creates a base branch for you.
The default branch name that Git uses is `master` (this will be changed to `main` later).

The Git-hosting ecosystem has settled on using `main` to replace `master`.
When you create a new repository on say GitHub or GitLab, you'll get a `main` branch as your base branch.

It therefore makes sense for Renovate to replace `master` with `main` where possible as well.

A branch name has no special meaning within the Git program, it's just a name.
The base branch could be called `trunk` or `mainline` or `prod`, and Git would work just as well.

## Which Renovate versions are officially supported?

The Renovate maintainers only support the latest version of Renovate.
The Renovate team will only create bugfixes for an older version if the hosted app needs to stay on an older major version for a short time or if some critical bug needs to be fixed and the new major is blocked.

If you're using the hosted app, you don't need to do anything, as the Renovate maintainers update the hosted app regularly.
If you're self hosting Renovate, use the latest release if possible.

## Renovate core features not supported on all platforms

| Feature              | Platforms which lack feature                      | See Renovate issue(s)                                        |
| -------------------- | ------------------------------------------------- | ------------------------------------------------------------ |
| Dependency Dashboard | BitBucket, BitBucket Server, Azure                | [#9592](https://github.com/renovatebot/renovate/issues/9592) |
| Hosted app           | GitLab, BitBucket, BitBucket Server, Azure, Gitea |                                                              |

## Major platform features not suported by Renovate

Some major platform features are not supported at all by Renovate.

| Feature name                            | Platform                               | See Renovate issue(s)                                        |
| --------------------------------------- | -------------------------------------- | ------------------------------------------------------------ |
| Jira issues                             | BitBucket                              | [#3796](https://github.com/renovatebot/renovate/issues/3796) |
| Merge trains                            | GitLab                                 | [#5573](https://github.com/renovatebot/renovate/issues/5573) |
| Cloning repo over SSH selfhosted        | None                                   | [#5406](https://github.com/renovatebot/renovate/issues/5406) |
| Configurable merge strategy and message | None, BitBucket will get support first | [#7184](https://github.com/renovatebot/renovate/issues/7184) |

## What if I need to .. ?

### Tell Renovate to ask for approval before creating a Pull Request

The default behavior is that Renovate creates a pull request right away whenever there's an update.
But maybe you want Renovate to ask for your approval _before_ it creates a pull request.
Use the "Dependency Dashboard approval" workflow to get updates for certain packages - or certain types of updates - only after you give approval via the Dependency Dashboard.

The basic idea is that you create a new `packageRules` entry and describe what kind of package, or type of updates you want to approve beforehand.

Say you want to manually approve all major `npm` package manager updates:

```json
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

Or say you want to manually approve all major Jest updates:

```json
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

You could even configure Renovate bot to ask for approval for _all_ updates.
The `dependencyDashboardApproval` is not part of a `packageRules` array, and so applies to all updates:

```json
{
  "dependencyDashboardApproval": true
}
```

Read our documentation on the [dependencyDashboardApproval](https://docs.renovatebot.com/configuration-options/#dependencydashboardapproval) config option.

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

See the dedicated [Private npm module support](./private-modules.md) page.

### Control Renovate's schedule

Renovate itself will run as often as its administrator has configured it (e.g. hourly, daily, etc).
You may want to update certain repositories less often.
Or you may even want to use different schedules for specific packages.

To control the days of the week or times of day that Renovate updates packages, use the `timezone` and `schedule` configuration options.
By default, Renovate schedules use the UTC timezone, but you can override this in the global config.

You can set a specific time zone in your local config file as well:

```json
{
  "timezone": "America/Los_Angeles"
}
```

The timezone must be a valid [IANA time zone](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones).

With the timezone set, you can define days of week or hours of the day in which Renovate will make changes.
Renovate uses the [@breejs/later](https://github.com/breejs/later) library to parse the text.
Read the parser documentation at [breejs.github.io/later/parsers.html#text](https://breejs.github.io/later/parsers.html#text).
The _@breejs/later_ library also handles the concepts of "days", time_before", and "time_after".
Renovate does not support scheduled minutes or "at an exact time" granularity.

Examples of the kind of schedules you can create:

```
every weekend
before 5:00am
[after 10pm, before 5:00am]
[after 10pm every weekday, before 5am every weekday]
on friday and saturday
```

The scheduling feature can be very useful for "noisy" packages that are updated frequently, such as `aws-sdk`.

To restrict `aws-sdk` to weekly updates, you could add this package rule:

```json
  "packageRules": [
    {
      "matchPackageNames": ["aws-sdk"],
      "schedule": ["after 9pm on sunday"]
    }
  ]
```

The "schedule" propery must always be defined in an array, even if you only set a single schedule.
Multiple entries in the array means "or".

### Disable Renovate for certain dependency types

Define a `packageRules` entry which has the dependency type(s) in `matchDepTypes` and `"enabled": false`.

### Use a single branch/PR for all dependency upgrades

Add a configuration for configuration option `groupName` set to value `"all"`, at the top level of your `renovate.json` or `package.json`.

### Use separate branches per dependency, but not one per major release

Set configuration option `separateMajorMinor` to `false`.

### Keep using SemVer ranges, instead of pinning dependencies

Set configuration option `rangeStrategy` to `"replace"`.

### Keep lock files (including sub-dependencies) up-to-date, even when `package.json` hasn't changed

By default, if you enable lock-file maintenance, Renovate will update the lockfile `["before 5am on monday"]`.
If you want to update the lock file more often, update the `schedule` field inside the `lockFileMaintenance` object.

### Wait until tests have passed before creating the PR

Set the configuration option `prCreation` to `"status-success"`.
Branches with failing tests will remain in Git and continue to get updated if necessary, but no PR will be created until their tests pass.

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
"packageRules": [
  {
    "matchPackageNames": ["abc"],
    "assignees": ["importantreviewer"]
  }
]
```

### Apply a rule, but only for packages starting with `abc`

Do the same as above, but instead of using `matchPackageNames`, use `matchPackagePatterns` and a regex:

```json
"packageRules": [
  {
    "matchPackagePatterns": "^abc",
    "assignees": ["importantreviewer"]
  }
]
```

### Group all packages starting with `abc` together in one PR

As above, but apply a `groupName`:

```json
"packageRules": [
  {
    "matchPackagePatterns": "^abc",
    "groupName": ["abc packages"]
  }
]
```

### Change the default values for branch name, commit message, PR title or PR description

You can use the `branchName`, `commitMessage`, `prTitle` or `prBody` configuration options to change the defaults for those settings.

### Automatically merge passing Pull Requests

Set the configuration option `automerge` to `true`.
Nest it inside config objects `patch` or `minor` if you want it to apply to certain types only.

### Separate patch releases from minor releases

#### Renovate's default behavior for major/minor releases

Renovate's default behavior is to separate major and minor releases, patch releases are also considered "minor".
Let's explain the default behavior with an example:

Say you are using a package `snorgleborf`, it's the `0.8.0` version.
The `snorgleborf` maintainers then release the following versions:

- `0.8.1` (patch)
- `0.9.0` (minor)
- `1.0.0` (major)

Renovate would then open the following PRs:

- Update dependency `snorgleborf` to `0.9.0` (minor)
- Update dependency `snorgleborf` to `1.0.0` (major)

Note how Renovate groups the patch and minor versions together into one PR.
This means you only get a PR for the minor version, `0.9.0`.

You can override the default behavior.
To learn more read the section below.

#### Overriding the default behavior for major/minor releases

You can see in the example above that Renovate won't normally open a PR for the `snorgleborf` patch release.

You can tell Renovate to open a separate PR for the patch release by setting `separateMinorPatch` to `true`.

In both cases, Renovate will open 3 PRs:

- Update dependency `snorgleborf` to `0.8.1` (patch)
- Update dependency `snorgleborf` to `0.9.0` (minor)
- Update dependency `snorgleborf` to `1.0.0` (major)

Most people don't want more PRs though.
But it can still be handy to get PRs for patches when using automerge:

- Get daily patch updates which are automerged once tests pass
- Get weekly updates for minor and major updates

The end result would be that you barely notice Renovate during the week, while you still get the benefits of patch level updates.
