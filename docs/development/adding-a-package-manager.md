# Adding a Package Manager

This document describes the steps to take if you want to add a new language/package manager.

## Code structure

Each package manager lives under `lib/modules/manager/*`, and is often tightly coupled to datasources under `lib/modules/datasource/*`.

Versioning logic (e.g. SemVer, PEP 440) lives under `lib/modules/versioning/*`.

Common application logic for Renovate, not specific to particular managers, usually lives under `lib/workers/*`.

## Manager requirements

The manager's `index.ts` file supports the following values/functions:

| Value/function                | Optional | Async |
| ----------------------------- | -------- | ----- |
| `bumpPackageVersion`          | yes      |       |
| `extractPackageFile`          |          | yes   |
| `extractAllPackageFiles`      |          | yes   |
| `getRangeStrategy`            | yes      |       |
| `language`                    | yes      |       |
| `supportsLockFileMaintenance` | yes      |       |
| `updateArtifacts`             | yes      | yes   |
| `updateDependency`            | yes      |       |
| `updateLockedDependency`      | yes      |       |

### `bumpPackageVersion` (optional)

Use this function to allow version bumps of updated packages.
For example, increase the version of a Maven module if a package has been updated.
Another example would be to bump the Helm chart version, if a subchart version has been updated.

### `extractPackageFile(content, packageFile, config)` (async, semi-mandatory)

This function is mandatory unless you use `extractAllPackageFiles` instead.
It takes as arguments the file's content and optionally the file's full file pathname and config.
The function returns an array of detected/extracted dependencies, including:

- dependency name
- dependency type (e.g. dependencies, devDependencies, etc)
- currentValue
- versioning used (e.g. SemVer, PEP 440)

The `extractPackageFile` function doesn't need to fully _understand_ the file or syntax that it gets.
It needs to understand enough to extract an accurate list of dependencies.

As a general approach, we extract _all_ dependencies from each dependency file, even if they have values we don't support.
Any dependency file that has values we cannot renovate, should have a `skipReason` message added to the `extractPackageFile` function.
Make sure the `skipReason` variable string is helpful to someone reading the logs.

Also, if a file is passed to `extractPackageFile` which is a "false match" (e.g. not an actual package file, or has no dependencies) then this function can return `null` to have it ignored and removed from the list of package files.

### `extractAllPackageFiles(packageFiles)` (async, optional)

Use this function instead of `extractPackageFile` if the package manager cannot parse/extract all package files in parallel.

For example, npm/Yarn needs to correlate package files together for features such as Lerna and Workspaces, so it's necessary to iterate through them all together after initial parsing.

As another example, Gradle needs to call a command via a child process in order to extract dependencies, so that must be done first.

The `extractAllPackageFiles` function takes an array of filenames as input.
It returns an array of filenames and dependencies.

### `getRangeStrategy(config)` (optional)

Write this optional function if you want the manager to support "auto" range strategies.
For example, pinning or not pinning a dependency, depending on other values in the package file.

The `npm` manager uses the `getRangeStrategy` function to pin `devDependencies` but not `dependencies` unless the package file is detected as an app.

If left undefined, then a default `getRangeStrategy` will be used that always returns "replace".

### `language` (optional)

This is used when more than one package manager shares settings from a common language.

### `supportsLockFileMaintenance` (optional)

Set to true if this package manager needs to update lock files in addition to package files.

### `updateArtifacts` (async, optional)

This function triggers:

- after a dependency update (for a package file), or
- during `lockfileMaintenance`

This function is mostly used to directly (or indirectly) update lock files.
An example of indirectly updating the lock file: running external binaries.

In case of directly updating dependencies in lock files use `updateLockedDependency` instead.

### `updateDependency` (optional)

`updateDependency` is used if the manager can not be updated with the standard replacing mechanisms and a custom replacement has to be provided.

### `updateLockedDependency` (optional)

This function should be used if dependencies in lock files are directly updated.
