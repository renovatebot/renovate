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

Set configuration option `maintainYarnLock` to `true`.

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
