---
title: Frequently Asked Questions (FAQ)
description: Frequently Asked Questions for Renovate Configuration
---

# Frequently Asked Questions (FAQ)

## What is the default behavior?

Renovate will:

- Look for configuration options in a configuration file (e.g. `renovate.json`) and in each `package.json` file
- Find and process all package files (e.g. `package.json`, `can-we-change-this-item?`, `Dockerfile`, etc) in each repository
- Use separate branches/PR for each dependency
- Use separate branches for each _major_ version of each dependency
- Pin devDependencies to a single version, rather than use ranges
- Pin dependencies to a single version if it appears not to be a library
- Update `yarn.lock` and/or `package-lock.json` files if found
- Create Pull Requests immediately after branch creation

## What if I need to .. ?

### Use an alternative branch as my Pull Request target

Say your repository's default branch is `master` but you want Renovate to use the `next` branch as its PR target.
You can configure the PR target branch via the `baseBranches` option.

Add this line to the `renovate.json` file that's in the _default_ branch (`master` in this example).

```json
{
  "baseBranches": ["next"]
}
```

You can set more than one PR target branch in the `baseBranches` array.

### Support private npm modules

See the dedicated [Private npm module support](/private-modules/) page.

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
Renovate uses the [later](https://bunkat.github.io/later/parsers.html#text) library to parse the text.
The _later_ library also handles the concepts of "days", time_before", and "time_after".

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
Failing branches will never get a Pull Request created until they eventually pass.

<!-- The above is really, really vague, please help me reword this. -->

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

Do the same as above, but instead of using `matchPackageNames`, use `matchPackagePatterns` and a regex. e.g.

```json
"packageRules": [
  {
    "matchPackagePatterns": "^abc",
    "assignees": ["importantreviewer"]
  }
]
```

### Group all packages starting with `abc` together in one PR

As above, but apply a `groupName`, e.g.

```json
"packageRules": [
  {
    "matchPackagePatterns": "^abc",
    "groupName": ["abc packages"]
  }
]
```

### Change the default branch name, commit message, PR title or PR description

Set the `branchName`, `commitMessage`, `prTitle` or `prBody` configuration options:

```json
"branchName": "vroom/{{depName}}-{{newMajor}}.x",
"commitMessage": "Vroom vroom dependency {{depName}} to version {{newValue}}",
"prTitle": "Vroom {{depName}},
```

### Automatically merge passing Pull Requests

Set configuration option `autoMerge` to `true`.
Nest it inside config objects `patch` or `minor` if you want it to apply to certain types only.

### Separate patch releases from minor releases

Renovate's default behavior is to separate major and minor releases, while patch releases are also consider "minor".
For example if you were running `q@0.8.7` you would receive one branch for the minor update to `q@0.9.7` and a second for the major update to `q@1.4.1`.

If you set the configuration option `separateMinorPatch` to `true`, or you configure `automerge` to have value `"patch"`, then Renovate will then separate patch releases as well.
For example, if you did this when running `q@0.8.7` then you'd receive three PRs - for `q@0.8.13`, `q@0.9.7` and `q@1.4.1`.

Of course, most people don't want _more_ PRs, so you would probably want to utilise this feature to make less work for yourself instead.
As an example, you might:

- Update patch updates daily and automerge if they pass tests
- Update minor and major updates weekly

The result of this would hopefully be that you barely notice Renovate during the week, while still getting the benefits of patch updates.
