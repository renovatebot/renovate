# Adding a Package Manager

This document explains how to add a new package manager.

## Code structure

Code for package managers goes in the `lib/modules/manager/*` directory.
The package manager code is often tightly coupled to the datasource code in `lib/modules/datasource/*`.

Versioning logic like Semver or PEP 440 goes in `lib/modules/versioning/*`.

Common application logic for Renovate, not specific to particular managers, usually lives under `lib/workers/*`.

## Manager requirements

The manager's `index.ts` file supports the following values or functions:

| Value/function                | Optional | Async |
| ----------------------------- | -------- | ----- |
| `bumpPackageVersion`          | yes      |       |
| `extractPackageFile`          |          | yes   |
| `extractAllPackageFiles`      | yes      | yes   |
| `getRangeStrategy`            | yes      |       |
| `categories`                  | yes      |       |
| `supportsLockFileMaintenance` | yes      |       |
| `updateArtifacts`             | yes      | yes   |
| `updateDependency`            | yes      |       |
| `updateLockedDependency`      | yes      |       |

### `bumpPackageVersion` (optional)

Use this function to allow version bumps of updated packages.
For example:

- to increase the version of a Maven module if a package has been updated
- to bump the Helm chart version, if a subchart version has been updated

### `extractPackageFile(content, packageFile, config)` (async, semi-mandatory)

This function is mandatory, unless you use `extractAllPackageFiles` instead.
It takes as arguments the file's content and optionally the file's full file pathname and config.
The function returns an array of detected or extracted dependencies, including the:

- dependency name
- dependency type (dependencies, devDependencies, etc)
- currentValue
- versioning used (like SemVer, PEP 440)

The `extractPackageFile` function doesn't need to fully _understand_ the file or syntax that it gets.
It needs to understand enough to extract a correct list of dependencies.

In general, we extract _all_ dependencies from each dependency file, even if they have values we don't support.

If the function reads parts of a dependency file that it can't parse, it should give a `skipReason` message to the `extractPackageFile` function.
Make sure the `skipReason` message is helpful to someone reading the logs.

If `extractPackageFile` is passed a file which is a "false match", so not a package file, or a file with no dependencies then it can return `null`.
Downstream this results in the file being ignored and removed from the list of package files.

### `extractAllPackageFiles(packageFiles)` (async, optional)

Normally a package manager parses or extracts all package files in _parallel_, and can thus use the `extractPackageFile` function.
If the package manager you're adding works in _serial_, use this function instead.

For example the npm and Yarn package manager must process the `package.json` and `package-lock` or `yarn.lock` files together.
This allows features like Workspaces to work.
This means that for npm or Yarn we need to iterate through all package files after the initial parsing.

As another example, in order for Gradle to extract dependencies Renovate must first call a command via a child process.

The `extractAllPackageFiles` function takes an array of filenames as input.
It returns an array of filenames and dependencies.

If you implement `extractAllPackageFiles` the manager must export as well either `updateDependency` or `extractPackageFile`.

### `getRangeStrategy(config)` (optional)

Write this optional function if you want the manager to support "auto" range strategies.
For example, pinning or _not_ pinning a dependency, depending on other values in the package file.

The `npm` manager uses the `getRangeStrategy` function to pin `devDependencies` but not `dependencies`, unless the package file is detected as an app.

If left undefined, then a default `getRangeStrategy` will be used that always returns "replace".

### `supportsLockFileMaintenance` (optional)

Set to `true` if this package manager needs to update lock files in addition to package files.

### `updateArtifacts` (async, optional)

Use `updateArtifacts` to run binaries that in turn will update files.
We often use `updateArtifacts` to update lock files indirectly.

To _directly_ update dependencies in lock files: use `updateLockedDependency` instead.

`updateArtifacts` gets triggered:

- after a dependency update (for a package file), or
- during `lockfileMaintenance`

### `updateDependency` (optional)

Use `updateDependency` if _both_ conditions apply:

- the manager can't be updated to use the standard replacing mechanism
- a custom replacement has to be provided

### `updateLockedDependency` (optional)

Use `updateLockedDependency` to directly update dependencies in lock files.
