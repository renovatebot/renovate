# Adding a Package Manager

This document describes the steps to take if you want to add a new language/package manager.

## Code structure

Each package manager lives under `lib/manager/*`, and is often tightly coupled to datasources under `lib/datasource/*`.

Versioning logic (e.g. SemVer, PEP 440) lives under `lib/versioning/*`.

Common application logic for Renovate, not specific to particular managers, usually lives under `lib/workers/*`.

## Manager requirements

The manager's `index.ts` file supports the following values/functions:

- extractPackageFile
- extractAllPackageFiles
- getRangeStrategy (optional)
- language (optional)
- supportsLockFileMaintenance (optional)

### `extractPackageFile(content, packageFile, config)` (async, semi-mandatory)

This function is mandatory unless you use `extractAllPackageFiles` instead.
It takes as arguments the file's content and optionally the file's full file pathname and config.
The function returns an array of detected/extracted dependencies, including:

- dependency name
- dependency type (e.g. dependencies, devDependencies, etc)
- currentValue
- versioning used (e.g. SemVer, PEP 440)

The `extractPackageFile` function doesn't need to fully _understand_ the file or syntax that it receives.
It needs to understand enough to extract an accurate list of dependencies.

As a general approach, we extract _all_ dependencies from each dependency file, even if they contain values we don't support.
Any dependency file that has values we cannot renovate, should have a `skipReason` message added to the `extractPackageFile` function.
Make sure the `skipReason` variable string is helpful to someone reading the logs.

Also, if a file is passed to `extractPackageFile` which is a "false match" (e.g. not an actual package file, or contains no dependencies) then this function can return `null` to have it ignored and removed from the list of package files.

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
