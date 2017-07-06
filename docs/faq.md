# FAQ

If you need a specific behaviour and it's not mentioned here - or it's more complicated - feel free to raise an [Issue](https://github.com/singapore/renovate/issues) - configuration questions are welcome in this repository.

## What Is The Default Behaviour?

Renovate will:

-   Look for configuration options in a `renovate.json` file and in each `package.json` file under the `renovate` object
-   Find and process all `package.json` files in each repository
-   Process `dependencies`, `devDependencies` and `optionalDependencies` in each `package.json`
-   Use separate branches/PR for each dependency
-   Use separate branches for each *major* version of each dependency
-   Pin dependencies to a single version, rather than use ranges
-   Update `yarn.lock` and/or `package-lock.json` files if found
-   Create Pull Requests immediately after branch creation

## What If I Need To .. ?

### Run renovate on all repositories that the account has access to

Set configuration option `autodiscover` to `true`, via CLI, environment, or configuration file. Obviously it's too late to set it in any `renovate.json` or `package.json`.

### Use an alternative branch for Pull Request target

If for example your repository default branch is `master` but your Pull Requests should target branch `next`, then you can configure this via the `baseBranch` configuration option. To do this, add this line to the `renovate.json` in the *default* branch (i.e. `master` in this example).

```json
{
  "baseBranch": "next"
}
```

### Support private npm modules

If you are running your own Renovate instance, then the easiest way to support private modules is to make sure the appropriate credentials are in `~/.npmrc`;

If you are using hosted Renovate instance, and your repository `package.json` includes private modules, then you can:

1.  Commit an `.npmrc` file to the repository, and Renovate will use this, or
2.  If using the [GitHub App hosted service](https://github.com/apps/renovate), authorize the npm user named "renovate" with read-only access to the relevant modules. This "renovate" account is used solely for the purpose of the renovate GitHub App.

### Control renovate's schedule

Renovate itself will run as often as its administrator has configured it (e.g. hourly, daily, etc). But you may wish to update certain repositories less often, or even specific packages at a different schedule.

If you want to control the days of the week or times of day that renovate updates packages, use the `timezone` and `schedule` configuration options.

By default, Renovate schedules will use the timezone of the machine that it's running on. This can be overridden in global config. Finally, it can be overridden on a per-repository basis too, e.g.:

```json
  "timezone": "America/Los_Angeles",
```

The timezone must be one of the valid [IANA time zones](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones).

Now that your timezone is set, you can define days of week or hours of the day in which renovate will make changes. For this we rely on text parsing of the library [later](http://bunkat.github.io/later/parsers.html#text) and its concepts of "days", "time_before", and "time_after".

Example scheduling:

```
every weekend
before 5:00am
after 10pm and before 5:00am
after 10pm and before 5am every weekday
on friday and saturday
```

This scheduling feature can be particularly useful for "noisy" packages that are updated frequently, such as `aws-sdk`.

To restrict `aws-sdk` to only weekly updates, you could add this package rule:

```json
  "packages": [
    {
      "packageName": "aws-sdk",
      "schedule": "after 9pm on sunday"
    }
  ]
```

### Selectively enable or disable renovate for specific `package.json` files

You could:

-   Add a `renovate.json` to the root of your repository and explicitly whitelist which `package.json` files you want renovated in the `packageFiles` configuration option, or
-   Add a `renovate` section to any `package.json` files you don't want renovated, with the configuration option `"enabled": false`

### Disable renovate for certain dependency types

If you want to disable `renovate` for `optionalDependencies`, for example, you could define your own `depTypes` array (in either a `renovate.json` or `package.json` file)

### Use a single branch/PR for all dependency upgrades

Add a configuration for configuration option `groupName` set to value `"all"`, at the top level of your `renovate.json` or `package.json`.

### Use separate branches per dependency, but not one per major release

Set configuration option `separateMajorReleases` to `false`.

### Keep using semver ranges, instead of pinning dependencies

Set configuration option `pinVersions` to `false`.

### Keep `yarn.lock` sub-dependencies up-to-date, even when `package.json` hasn't changed

This is enabled by default, but its schedule is set to 'before 5am on monday'. If you want it more frequently, then update the `schedule` field inside the `lockFileMaintenance` object.

### Wait until tests have passed before creating the PR

Set configuration option `prCreation` to `"status-success"`

### Wait until tests have passed before creating a PR, but create the PR even if they fail

Set configuration option `prCreation` to `"not-pending"`

### Assign PRs to specific user(s)

Set the configuration option `assignees` to an array of usernames.

### Add labels to PRs

Set the configuration option `labels` to an array of labels to use

### Apply a rule, but only to package `abc`?

1.  Add a `packages` array to your configuration.
2.  Create one object inside this array
3.  Set field `packageName` to value `"abc"`
4.  Add the configuration option to the same object.

e.g.

```json
"packages": [
  {
    "packageName": "abc",
    "assignees": ["importantreviewer"]
  }
]
```

### Apply a rule, but only for packages starting with `abc`

Do the same as above, but instead of using `packageName`, use `packagePattern` and a regex. e.g.

```json
"packages": [
  {
    "packagePattern": "^abc",
    "assignees": ["importantreviewer"]
  }
]
```

### Group all packages starting with `abc` together in one PR

As above, but apply a `groupName`, e.g.

```json
"packages": [
  {
    "packagePattern": "^abc",
    "groupName": ["abc packages"]
  }
]
```

### Change the default branch name, commit message, PR title or PR description

Set the `branchName`, `commitMessage`, `prTitle` or `prBody` configuration options:

```json
"branchName": "vroom/{{depName}}-{{newVersionMajor}}.x",
"commitMessage": "Vroom vroom dependency {{depName}} to version {{newVersion}}",
"prTitle": "Vroom {{depName}},
```

### Automatically merge passing Pull Requests

Set configuration option `autoMerge` to `minor` if you want this to apply only to minor upgrades, or set to value `all` if you want it applied to both minor and major upgrades.
